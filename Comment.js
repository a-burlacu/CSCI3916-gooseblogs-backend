var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

try {
    mongoose.connect( process.env.DB, {useNewUrlParser: true, useUnifiedTopology: true}, () =>
        console.log("connected"));
}catch (error) {
    console.log("could not connect");
}
mongoose.set('useCreateIndex', true);

// creating the comment schema with all necessary fields
const CommentSchema = new Schema({
    blogPostTitle : {type: String, required: true},
    username: {type: String, required: true, index: {unique: true}},
    quote: {type: String},

});


//return the model to server
module.exports = mongoose.model('Comment', CommentSchema);