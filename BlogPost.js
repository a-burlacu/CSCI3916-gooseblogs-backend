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

// creating the blog post schema with all necessary fields
const BlogPostSchema = new Schema({
    title: {type: String, required: true, index: {unique: true}},
    username: {type: String, required: true},
    postBody: {type: String, required: true},
    imageUrl: {type: String, required: true}
});


//return the model to server
module.exports = mongoose.model('BlogPost', BlogPostSchema);