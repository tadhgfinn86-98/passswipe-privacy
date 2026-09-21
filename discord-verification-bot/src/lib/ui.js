'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const COLORS = {
  brand: 0x6e3cff,
  success: 0x2ecc71,
  warn: 0xf1c40f,
  danger: 0xe74c3c,
};

const IDS = {
  start: 'verify:start',
  open: 'verify:open',
  modal: 'verify:modal',
  input: 'verify:answer',
};

const MODE_BLURB = {
  captcha: 'You will be shown a short code to type back.',
  math: 'You will be asked to solve a simple sum.',
  button: 'One click is all it takes.',
};

/** The persistent panel that lives in the verification channel. */
function panel({ mode, roleName, description }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle('Member verification')
    .setDescription(
      description ||
        [
          `Press **Verify** below to unlock the rest of the server.`,
          MODE_BLURB[mode] || MODE_BLURB.captcha,
        ].join('\n\n'),
    )
    .setFooter({ text: roleName ? `You will be given the @${roleName} role` : 'Verification' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.start)
      .setLabel('Verify')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

/** Ephemeral captcha card plus the button that opens the answer modal. */
function captchaCard(prompt) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle('Type the code you see')
    .setDescription(`\`\`\`\n${prompt}\n\`\`\``)
    .setFooter({ text: 'Case does not matter. The code expires in 5 minutes.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.open)
      .setLabel('Enter code')
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [row] };
}

/** Modal built per interaction so the question can be part of the label. */
function answerModal(kind, prompt) {
  const isMath = kind === 'math';
  const input = new TextInputBuilder()
    .setCustomId(IDS.input)
    .setLabel(isMath ? `What is ${prompt}?` : 'Enter the code')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(12);

  if (!isMath) input.setPlaceholder('e.g. A4K9P2');

  return new ModalBuilder()
    .setCustomId(IDS.modal)
    .setTitle('Verification')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function notice(color, title, description) {
  return new EmbedBuilder().setColor(COLORS[color]).setTitle(title).setDescription(description);
}

/** Audit-log entry posted to the configured log channel. */
function logEntry({ member, outcome, reason }) {
  const colorFor = { verified: 'success', failed: 'warn', blocked: 'danger' };
  return new EmbedBuilder()
    .setColor(COLORS[colorFor[outcome] || 'brand'])
    .setAuthor({ name: `${member.user.tag} (${member.id})`, iconURL: member.user.displayAvatarURL() })
    .setTitle(`Verification ${outcome}`)
    .setDescription(reason || null)
    .addFields({
      name: 'Account created',
      value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      inline: true,
    })
    .setTimestamp();
}

module.exports = { COLORS, IDS, panel, captchaCard, answerModal, notice, logEntry };
