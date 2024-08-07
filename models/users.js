const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const UsersSchema = new Schema({
    names: {type: String, require: true, min: 4},
    email: {type: String, require: true, unique: true},
    password: {type: String, require: true}
    
});

const UsersModel = model('users', UsersSchema );

module.exports = UsersModel;