const { Telegraf, session } = require("telegraf");
const fs = require("fs");
const path = require("path");

// ============================
// BOT TOKEN (from Render ENV)
// ============================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing! Set it in Render Environment Variables");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());
bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {};
  return next();
});

// ============================
// Keyboard helper
// ============================
const kb = (rows) => ({ reply_markup: { keyboard: rows, resize_keyboard: true } });

// ============================
// /start
// ============================
bot.start((ctx) => {
  ctx.session = { step: "grade" };
  ctx.reply(
    "👋 Welcome student!\nChoose your grade:",
    kb([["Grade 9","Grade 10"],["Grade 11","Grade 12"]])
  );
});

// ============================
// Grade selection
// ============================
bot.hears(/Grade (9|10|11|12)/, (ctx) => {
  ctx.session.grade = ctx.match[1];
  ctx.session.step = "subject";
  ctx.reply(
    "📘 Choose a subject:",
    kb([["Math","Biology"],["Chemistry","Physics"],["English","Social"],["Back"]])
  );
});

// ============================
// Subject selection
// ============================
bot.hears(["Math","Biology","Chemistry","Physics","English"], (ctx) => {
  ctx.session.subject = ctx.message.text.toLowerCase();
  ctx.session.step = "unit";
  ctx.reply(
    "📂 Choose a unit:",
    kb([["Unit 1","Unit 2"],["Unit 3","Unit 4"],["Unit 5","Back"]])
  );
});

// ============================
// Social subjects
// ============================
bot.hears("Social", (ctx) => {
  ctx.session.step = "social";
  ctx.reply(
    "Choose Social subject:",
    kb([["History","Geography"],["Civics","Economics"],["Back"]])
  );
});

bot.hears(["History","Geography","Civics","Economics"], (ctx) => {
  ctx.session.subject = `social/${ctx.message.text.toLowerCase()}`;
  ctx.session.step = "unit";
  ctx.reply(
    "📂 Choose a unit:",
    kb([["Unit 1","Unit 2"],["Unit 3","Unit 4"],["Unit 5","Back"]])
  );
});

// ============================
// Unit selection
// ============================
bot.hears(/Unit (\d+)/, (ctx) => {
  if (!ctx.session.grade || !ctx.session.subject) {
    return ctx.reply("⚠ Please choose grade and subject first.");
  }

  const unit = ctx.match[1];
  const { grade, subject } = ctx.session;

  const filePath = path.join(__dirname,"data",`grade${grade}`,subject,`unit${unit}.json`);
  if (!fs.existsSync(filePath)) return ctx.reply("⚠ No questions found for this unit.");

  let data;
  try { data = JSON.parse(fs.readFileSync(filePath,"utf8")); }
  catch { return ctx.reply("❌ Invalid JSON file."); }

  if (!data[0]?.questions?.length) return ctx.reply("⚠ This unit has no questions.");

  ctx.session.questions = data[0].questions;
  ctx.session.qIndex = 0;
  ctx.session.step = "quiz";

  sendQuestion(ctx);
});

// ============================
// Send question
// ============================
function sendQuestion(ctx){
  const q = ctx.session.questions[ctx.session.qIndex];
  let text = `📝 Q${ctx.session.qIndex+1}: ${q.question}\n\n`;
  for(const key in q.options) text += `${key}. ${q.options[key]}\n`;
  ctx.reply(text, kb([Object.keys(q.options),["Show Answer","Next"],["Back","Exit"]]));
}

// ============================
// Quiz handling
// ============================
bot.on("text",(ctx)=>{
  if(!ctx.session || ctx.session.step!=="quiz") return;

  const text = ctx.message.text;
  const q = ctx.session.questions[ctx.session.qIndex];

  if(text==="Show Answer") return ctx.reply(`✅ Answer: ${q.correct_option}. ${q.options[q.correct_option]}`);
  if(text==="Next"){
    ctx.session.qIndex++;
    if(ctx.session.qIndex>=ctx.session.questions.length){
      ctx.session.step="grade";
      ctx.session.questions=null;
      ctx.session.qIndex=null;
      return ctx.reply("🎉 Unit completed!\nChoose your grade:", kb([["Grade 9","Grade 10"],["Grade 11","Grade 12"]]));
    }
    return sendQuestion(ctx);
  }

  if(text==="Exit"){
    ctx.session.step="grade";
    ctx.session.questions=null;
    ctx.session.qIndex=null;
    return ctx.reply("❌ Exited.\nChoose your grade:", kb([["Grade 9","Grade 10"],["Grade 11","Grade 12"]]));
  }

  if(!/^[A-D]$/.test(text)) return;

  ctx.reply(text===q.correct_option?"✅ Correct!":`❌ Wrong.\nCorrect: ${q.correct_option}. ${q.options[q.correct_option]}`);
});

// ============================
// Back button
// ============================
bot.hears("Back",(ctx)=>{
  if(!ctx.session.step) return;

  if(ctx.session.step==="quiz"){ ctx.session.step="unit"; return ctx.reply("📂 Choose a unit:", kb([["Unit 1","Unit 2"],["Unit 3","Unit 4"],["Unit 5","Back"]])); }
  if(ctx.session.step==="unit" || ctx.session.step==="social"){ ctx.session.step="subject"; return ctx.reply("📘 Choose a subject:", kb([["Math","Biology"],["Chemistry","Physics"],["English","Social"],["Back"]])); }
  if(ctx.session.step==="subject"){ ctx.session.step="grade"; return ctx.reply("Choose your grade:", kb([["Grade 9","Grade 10"],["Grade 11","Grade 12"]])); }
});

// ============================
// Launch bot
// ============================
bot.launch();
console.log("🤖 Bot running...");

// Graceful shutdown
process.once("SIGINT",()=>bot.stop("SIGINT"));
process.once("SIGTERM",()=>bot.stop("SIGTERM"));
