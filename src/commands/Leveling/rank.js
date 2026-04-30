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
        try {
            await InteractionHelper.safeDefer(interaction);

            // 1. Check if Leveling is enabled
            const levelingConfig = await getLevelingConfig(client, interaction.guildId);
            if (!levelingConfig?.enabled) {
                await InteractionHelper.safeEditReply(interaction, {
                    content: 'The leveling system is currently disabled on this server.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // 2. Get User Data
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!member) {
                throw new TitanBotError(`User ${targetUser.id} not found`, ErrorTypes.USER_INPUT, 'User not found.');
            }

            const userData = await getUserLevelData(client, interaction.guildId, targetUser.id);
            const level = userData?.level ?? 0;
            const xp = userData?.xp ?? 0;
            const xpNeeded = getXpForLevel(level + 1);

            // 3. Draw the Rank Card
            const canvas = Canvas.createCanvas(700, 250);
            const ctx = canvas.getContext('2d');

            // Dark Background
            ctx.fillStyle = '#23272a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Avatar Circle
            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 45, 45, 160, 160);
            ctx.restore();

            // Text Styles
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(member.displayName, 240, 80);

            ctx.font = '24px sans-serif';
            ctx.fillText(`Level ${level}`, 240, 130);
            ctx.fillText(`${xp} / ${xpNeeded} XP`, 500, 130);

            // Progress Bar
            ctx.fillStyle = '#484b4e';
            ctx.fillRect(240, 160, 400, 25);
            const progress = Math.min(xp / xpNeeded, 1);
            ctx.fillStyle = '#5865F2'; // Discord Blue
            ctx.fillRect(240, 160, 400 * progress, 25);

            // 4. Create Shop Button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_shop')
                    .setLabel('🛒 Card Shop')
                    .setButtonStyle(ButtonStyle.Primary)
            );

            const attachment = new AttachmentBuilder(await canvas.toBuffer(), { name: 'rank.png' });

            // 5. Send Result
            const response = await InteractionHelper.safeEditReply(interaction, { 
                files: [attachment], 
                components: [row] 
            });

            // 6. Shop Interaction Collector
            const filter = (i) => i.customId === 'open_shop' && i.user.id === interaction.user.id;
            const collector = response.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (i) => {
                await i.reply({
                    content: '### ✨ Limited GIF Card Shop\nSelect a background to preview (Gifs coming soon!):',
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('shop_1').setLabel('🔥 Fire').setButtonStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('shop_2').setLabel('🌌 Galaxy').setButtonStyle(ButtonStyle.Secondary)
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
            });

        } catch (error) {
            logger.error('Rank command error:', error);
            await handleInteractionError(interaction, error, { type: 'command', commandName: 'rank' });
        }
    }
};
