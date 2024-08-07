const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const PostSchema = new Schema({
    title: {type: String, require: true},
    category: {type: String, require: true},
    content: {type: String, require: true},
    imageUrl:{type:String},
    datePosted: {type:Date, default: Date.now()},
    posterDetails: {
        author: String,
        email: String
    },
    tags: {type: [String] },
    isSpecial:{ type: Boolean, default: false },
    featured:{type: Boolean, default: false }
    
});

const PostModel = model('posts', PostSchema );

module.exports = PostModel;