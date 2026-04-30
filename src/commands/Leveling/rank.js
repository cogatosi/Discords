import { 
    SlashCommandBuilder, 
    AttachmentBuilder, 
    MessageFlags, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getUserLevelData, getLevelingConfig, getXpForLevel } from '../../services/leveling.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import Canvas from 'canvas';

export default {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription("Check your or another user's rank and level")
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The user to check the rank of')
                .setRequired(false)
        )
        .setDMPermission(false),
    category: 'Leveling',

    async execute(interaction, config, client) {
        // 1. Initial Deferral
        await InteractionHelper.safeDefer(interaction);

        let canvasBuffer;
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // 2. Data & Canvas Block (The only part that should show the Red Error Box if it fails)
        try {
            const levelingConfig = await getLevelingConfig(client, interaction.guildId);
            if (!levelingConfig?.enabled) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: 'The leveling system is currently disabled on this server.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) throw new Error('User not found');

            const userData = await getUserLevelData(client, interaction.guildId, targetUser.id);
            const level = userData?.level ?? 0;
            const xp = userData?.xp ?? 0;
            const xpNeeded = getXpForLevel(level + 1);

            const canvas = Canvas.createCanvas(700, 250);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#23272a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 45, 45, 160, 160);
            ctx.restore();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(member.displayName, 240, 80);

            ctx.font = '24px sans-serif';
            ctx.fillText(`Level ${level}`, 240, 130);
            ctx.fillText(`${xp} / ${xpNeeded} XP`, 500, 130);

            ctx.fillStyle = '#484b4e';
            ctx.fillRect(240, 160, 400, 25);
            const progress = Math.min(xp / xpNeeded, 1);
            ctx.fillStyle = '#5865F2';
            ctx.fillRect(240, 160, 400 * progress, 25);

            canvasBuffer = await canvas.toBuffer();
        } catch (error) {
            logger.error('Rank Canvas Error:', error);
            return await handleInteractionError(interaction, error, { type: 'command', commandName: 'rank' });
        }

        // 3. UI and Interaction Block (NO RED ERROR BOX ALLOWED HERE)
        try {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_shop').setLabel('🛒 Card Shop').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('open_settings').setLabel('⚙️ Settings').setStyle(ButtonStyle.Secondary)
            );

            const attachment = new AttachmentBuilder(canvasBuffer, { name: 'rank.png' });

            const response = await InteractionHelper.safeEditReply(interaction, { 
                files: [attachment], 
                components: [row] 
            });

            const collector = response.createMessageComponentCollector({ 
                filter: (i) => i.user.id === interaction.user.id, 
                time: 60000 
            });

            collector.on('collect', async (i) => {
                // Silently handle button clicks
                try {
                    if (i.customId === 'open_shop') {
                        await i.reply({
                            content: '### ✨ Limited GIF Card Shop\nSelect a background to preview:',
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('shop_1').setLabel('🔥 Fire').setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder().setCustomId('shop_2').setLabel('🌌 Galaxy').setStyle(ButtonStyle.Secondary)
                                )
                            ],
                            flags: MessageFlags.Ephemeral 
                        });
                    } else if (i.customId === 'open_settings') {
                        await i.reply({
                            content: '### ⚙️ Rank Settings\nChoose a NamePlate style:',
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('plate_classic').setLabel('Classic').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('plate_neon').setLabel('Neon').setStyle(ButtonStyle.Success),
                                    new ButtonBuilder().setCustomId('plate_dark').setLabel('Dark Mode').setStyle(ButtonStyle.Secondary)
                                )
                            ],
                            flags: MessageFlags.Ephemeral 
                        });
                    }
                } catch (err) {
                    logger.error('Button Click Error (Silent):', err);
                }
            });

            collector.on('end', () => {
                // Just remove components, no error calls
                interaction.editReply({ components: [] }).catch(() => null);
            });

        } catch (uiError) {
            logger.error('UI Logic Error (Silent):', uiError);
        }
    }
};
