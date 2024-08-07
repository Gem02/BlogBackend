const mongoose = require('mongoose');


const connectDb = async () =>{
    try {
    const conn = await mongoose.connect(process.env.MONGO_URL); 
    if (conn) {
        console.log(`MongoDB connected`);
    }
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

module.exports = connectDb;
