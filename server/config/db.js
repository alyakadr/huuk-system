const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/huuk";
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully");
  } catch (err) {
    console.error("Warning: MongoDB connection failed:", err.message);
    console.log("App will continue running, but database features may not work");
  }
};

connectDB();

module.exports = mongoose;
