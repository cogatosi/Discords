import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import Canvas from 'canvas';

export const data = new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Shows your custom user card');

export async function execute(interaction) {
    const canvas = Canvas.createCanvas(700, 250);
    const context = canvas.getContext('2d');

    // Background
    context.fillStyle = '#23272a'; 
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Username
    context.font = '45px sans-serif';
    context.fillStyle = '#ffffff';
    context.fillText(interaction.user.username, 250, 100);

    // Level Bar
    context.fillStyle = '#5865F2'; 
    context.fillRect(250, 150, 300, 25);

    const attachment = new AttachmentBuilder(await canvas.toBuffer(), { name: 'profile.png' });
    await interaction.reply({ files: [attachment] });
}
