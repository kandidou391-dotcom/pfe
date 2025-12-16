const mongoose = require("mongoose");

module.exports.connectToMongoDB = async () => {
  mongoose.set("strictQuery", false);

  // Connection options for better performance
  const options = {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  };

  mongoose
    .connect(process.env.url_mongodb, options)
    .then(() => {
      console.log("Connected to MongoDB with optimized settings");
    })
    .catch((err) => {
      console.error("Error connecting to MongoDB", err);
    });
};
