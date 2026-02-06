const { Telegraf, session } = require("telegraf");
const fs = require("fs");
const path = require("path");

// ============================
// BOT TOKEN
// ============================
const BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
const bot = new Telegraf(BOT_TOKEN);

// ============================
// SESSION
// ============================
bot.use(session());
bot.use((ctx, next) => {
  ctx.session ??= {};
  return next();
});

// ============================
// KEYBOARD HELPER
// ============================
const kb = (rows) => ({
  reply_markup: { keyboard: rows, resize_keyboard: true }
});

// ============================
// START
// ============================
bot.start((ctx) => {
  ctx.session = { step: "grade" };
  ctx.reply(
    "👋 Welcome student!\nChoose your grade:",
    kb([
      ["Grade 9", "Grade 10"],
      ["Grade 11", "Grade 12"]
    ])
  );
});

// ============================
// GRADE
// ============================
bot.hears(/Grade (9|10|11|12)/, (ctx) => {
  ctx.session.grade = ctx.match[1];
  ctx.session.step = "subject";

  ctx.reply(
    "📘 Choose a subject:",
    kb([
      ["Math", "Biology"],
      ["Chemistry", "Physics"],
      ["English", "Social"],
      ["Back"]
    ])
  );
});

// ============================
// SUBJECTS
// ============================
bot.hears(["Math", "Biology", "Chemistry", "Physics", "English"], (ctx) => {
  ctx.session.subject = ctx.message.text.toLowerCase();
  ctx.session.step = "unit";

  ctx.reply(
    "📂 Choose a unit:",
    kb([
      ["Unit 1", "Unit 2"],
      ["Unit 3", "Unit 4"],
      ["Unit 5", "Back"]
    ])
  );
});

// ============================
// SOCIAL
// ============================
bot.hears("Social", (ctx) => {
  ctx.session.step = "social";
  ctx.reply(
    "Choose Social subject:",
    kb([
      ["History", "Geography"],
      ["Civics", "Economics"],
      ["Back"]
    ])
  );
});

bot.hears(["History", "Geography", "Civics", "Economics"], (ctx) => {
  ctx.session.subject = `social/${ctx.message.text.toLowerCase()}`;
  ctx.session.step = "unit";

  ctx.reply(
    "📂 Choose a unit:",
    kb([
      ["Unit 1", "Unit 2"],
      ["Unit 3", "Unit 4"],
      ["Unit 5", "Back"]
    ])
  );
});

// ============================
// UNIT
// ============================
bot.hears(/Unit (\d+)/, (ctx) => {
  if (!ctx.session.grade || !ctx.session.subject) {
    return ctx.reply("⚠ Please select grade and subject first.");
  }

  const unit = ctx.match[1];
  const filePath = path.join(
    __dirname,
    "data",
    `grade${ctx.session.grade}`,
    ctx.session.subject,
    `unit${unit}.json`
  );

  if (!fs.existsSync(filePath)) {
    return ctx.reply("⚠ No questions found for this unit.");
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data[0]?.questions?.length) {
    return ctx.reply("⚠ This unit has no questions.");
  }

  ctx.session.questions = data[0].questions;
  ctx.session.qIndex = 0;
  ctx.session.step = "quiz";

  sendQuestion(ctx);
});

// ============================
// SEND QUESTION
// ============================
function sendQuestion(ctx) {
  const q = ctx.session.questions[ctx.session.qIndex];

  let text = `📝 Q${ctx.session.qIndex + 1}: ${q.question}\n\n`;
  for (const k in q.options) {
    text += `${k}. ${q.options[k]}\n`;
  }

  ctx.reply(
    text,
    kb([
      Object.keys(q.options),
      ["Show Answer", "Next"],
      ["Back", "Exit"]
    ])
  );
}

// ============================
// QUIZ BUTTONS (NO bot.on("text"))
// ============================
bot.hears("Show Answer", (ctx) => {
  if (ctx.session.step !== "quiz") return;
  const q = ctx.session.questions[ctx.session.qIndex];
  ctx.reply(`✅ Answer: ${q.correct_option}. ${q.options[q.correct_option]}`);
});

bot.hears("Next", (ctx) => {
  if (ctx.session.step !== "quiz") return;

  ctx.session.qIndex++;
  if (ctx.session.qIndex >= ctx.session.questions.length) {
    ctx.session = { step: "grade" };
    return ctx.reply(
      "🎉 Unit completed!\nChoose your grade:",
      kb([
        ["Grade 9", "Grade 10"],
        ["Grade 11", "Grade 12"]
      ])
    );
  }

  sendQuestion(ctx);
});

bot.hears("Exit", (ctx) => {
  ctx.session = { step: "grade" };
  ctx.reply(
    "❌ Exited.\nChoose your grade:",
    kb([
      ["Grade 9", "Grade 10"],
      ["Grade 11", "Grade 12"]
    ])
  );
});

// ============================
// ANSWER (A–D ONLY)
// ============================
bot.hears(/^[A-D]$/, (ctx) => {
  if (ctx.session.step !== "quiz") return;

  const q = ctx.session.questions[ctx.session.qIndex];
  ctx.reply(
    ctx.message.text === q.correct_option
      ? "✅ Correct!"
      : `❌ Wrong.\nCorrect: ${q.correct_option}. ${q.options[q.correct_option]}`
  );
});

// ============================
// BACK (100% WORKING)
// ============================
bot.hears("Back", (ctx) => {
  switch (ctx.session.step) {
    case "quiz":
      ctx.session.step = "unit";
      return ctx.reply(
        "📂 Choose a unit:",
        kb([
          ["Unit 1", "Unit 2"],
          ["Unit 3", "Unit 4"],
          ["Unit 5", "Back"]
        ])
      );

    case "unit":
    case "social":
      ctx.session.step = "subject";
      return ctx.reply(
        "📘 Choose a subject:",
        kb([
          ["Math", "Biology"],
          ["Chemistry", "Physics"],
          ["English", "Social"],
          ["Back"]
        ])
      );

    case "subject":
      ctx.session.step = "grade";
      return ctx.reply(
        "Choose your grade:",
        kb([
          ["Grade 9", "Grade 10"],
          ["Grade 11", "Grade 12"]
        ])
      );
  }
});

// ============================
// LAUNCH
// ============================
bot.launch();
console.log("🤖 Bot running...");

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
