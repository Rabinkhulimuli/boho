const mongoose = require("mongoose");
const dbgr = require("debug")("development:mongoose");

// Get MongoDB URI from environment variable
const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
  console.error(" MONGO_URL is not defined. Please set it in Vercel Environment Variables.");
  process.exit(1);
}

mongoose
  .connect(`${mongoUrl}/premiumbagshop`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => dbgr(" Connected to MongoDB"))
  .catch((err) => dbgr(" MongoDB connection error:", err));

module.exports = mongoose.connection;
