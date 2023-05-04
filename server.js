var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var BlogPost = require('./BlogPost');
var Comment = require('./Comment');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        status: "No status",
        msg: "No Msg",
        headers : "No Headers",
        query: "No Query",
        key: process.env.UNIQUE_KEY,
        body : "No Body"
    };

    if (req.body != null) {
        json.body = req.body;
    }
    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json; // returning the object
}

const includedMethods = ['PUT', 'POST', 'DELETE', 'GET'];


router.use((req, res, next) => {
    if (includedMethods.indexOf(req.method) == -1) {
        res.send("Error: HTTP method not supported!");
        return;
    }
    next();
});

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({success: false, msg: 'Please include both username and password to signup.'});
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.status(400).json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            return res.status(200).json({success: true, msg: 'Successfully created new user.'});
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }
        else if(!userNew.username || !userNew.password || !user){
            return res.status(401).send({success: false, msg: 'Authentication failed.'});
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                return res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

// blogpost parameter routes where we also check review query
router.route('/blogposts/*')
    .get(authJwtController.isAuthenticated, function(req, res){ // on GET, get the specific blogpost based off the param
        BlogPost.findOne({title: req.params['0']}, function(err, blogpost){
            if(err) {
                return res.status(400).json(err);
            }
            else if(!blogpost){
                return res.status(400).json({success: false, msg: "BlogPost does not exist!"});
            }
            else{
                if(req.query.comments === "true"){ // checking the review query param
                    BlogPost.aggregate([ // using the $match and $lookup aggregation methods, we can join the comments collection for a specific blogpost
                        {
                            $match: {
                                title: req.params['0']
                            }
                        },
                        {
                            $lookup: {
                                from: "comments",
                                localField: "title",
                                foreignField: "blogpostTitle",
                                as: "blogpostComments"
                            }
                        },
                        // {
                        //     // get the average rating as a new field on the aggregate
                        //     $addFields:
                        //         {
                        //             avgRating: {$avg: "$blogPostComments.rating"}
                        //         }
                        //
                        // },
                        // {
                        //     $sort:
                        //         {
                        //             avgRating: -1
                        //         }
                        // }
                    ]).exec(function(err, blogPostComments){
                        if(err){
                            return res.status(400).json(err)
                        }
                        else {
                            return res.status(200).json(blogPostComments);
                        }
                    })
                }
                else{ // if comments=false, we just return the blogpost
                    return res.status(200).json(blogpost);
                }
            }
        })
    })
    .put(authJwtController.isAuthenticated, function(req, res){
        let update = req.body;
        BlogPost.findOneAndUpdate({title: req.params['0']}, update, {new: true}, function(err, data){
            if(err){
                return res.status(400).json(err);
            }
            else{
                return res.status(200).json(data);
            }
        })
    })
    .post(authJwtController.isAuthenticated, function(req, res){
        return res.status(400).send({success: false, msg: 'POST Denied on /blogpostparameter'});
    })
    // for DELETE, delete a blogpost
    .delete(authJwtController.isAuthenticated, function(req, res){
        BlogPost.deleteOne({title: req.params['0']}, null, function(err, data){
            if(err){
                return res.status(400).json(err);
            }
            else{
                return res.status(200).json({success: true, msg: 'BlogPost is deleted!'});
            }
        });
    })

// blogpost routes with review query
router.route('/blogposts')
    .delete(authJwtController.isAuthenticated, function(req, res){ // fail on the /blogposts DELETE
            return res.status(400).send({success: false, msg: 'DELETE Denied on /blogposts'});
        }
    )
    .put(authJwtController.isAuthenticated, function(req, res){ // fail on the /blogposts PUT
            return res.status(400).send({success: false, msg: 'PUT Denied on /blogposts'});
        }
    )
    .get(authJwtController.isAuthenticated, function(req, res){ // in GET, we want to return all blogposts in the collection
            BlogPost.find({}, (err, blogposts) => {
                if(err)
                    return res.status(400).json(err);
                else{
                    if(req.query.comments === "true"){ // checking the review query param
                        BlogPost.aggregate([ // using the $lookup aggregation method, we can join the comments collection for all blogposts
                            {
                                $lookup: {
                                    from: "comments",
                                    localField: "title",
                                    foreignField: "blogpostTitle",
                                    as: "blogPostComments"
                                }
                            },
                            // {
                            //     // get the average rating as a new field on the aggregate
                            //     $addFields:
                            //         {
                            //             avgRating: {$avg: "$movieReviews.rating"}
                            //         }
                            // },
                            // {
                            //     $sort:
                            //         {
                            //             avgRating: -1
                            //         }
                            // }
                        ]).exec(function(err, movieReviews){
                            if(err){
                                return res.status(400).json(err)
                            }
                            else {
                                return res.status(200).json(movieReviews);
                            }
                        })
                    }
                    else{
                        return res.json(blogposts); // otherwise, if comments=false, we just return all blogposts
                    }
                }
            })
        }
    )
    .post(authJwtController.isAuthenticated,function(req, res) { // in POST, we want to save a single blogpost
            let newBlogPost = new BlogPost();
            newBlogPost.title = req.body.title;
            newBlogPost.username = req.body.username;
            newBlogPost.postBody = req.body.postBody;
            newBlogPost.imageUrl = req.body.imageUrl;

            if(newBlogPost.title === "" || newBlogPost.username === "" || newBlogPost.postBody === "" || // error checking
                newBlogPost.imageUrl === ""){
                return res.status(400).send({success: false, msg: "Cannot save a new post object that does not have all required fields."});
            }
            // else if(newBlogPost.actors.length < 3){
            //     return res.status(400).send({success: false, msg: "Cannot save a new blogpost object without at least 3 actors."})
            // }
            else{
                newBlogPost.save(function(err){
                    if(err) {
                        if (err.code == 11000)
                            return res.status(400).json({success: false, message: 'This post already exists!'});
                        else
                            return res.json(err);
                    }
                    return res.status(200).json({success: true, msg: 'Successfully saved new post.'});
                });
            }
        }
    );

// review route for posting a review, and getting all comments
router.route('/comment')
    .post(authJwtController.isAuthenticated,function(req, res){ // in posting a review, we get info from the req body and do error checking
        let newComment = new Comment();
        newComment.blogpostTitle = req.body.blogpostTitle;
        newComment.username = req.body.username;
        newComment.quote = req.body.quote;

        if(newComment.blogpostTitle === "" || newComment.username === "" || newComment.quote === ""){
            return res.status(400).send({success: false, msg: "Cannot post a comment without the name of the original blog post, the name of the poster, and a rating of 1-5 stars."});
        }
        else{
            BlogPost.findOne({blogpostTitle: newComment.blogpostTitle}, function(err, blogpost){ // find if blogpost even exists first
                if(err) {
                    return res.status(400).json(err);
                }
                else if(!blogpost){
                    return res.status(400).json({success: false, msg: "Blog post does not exist!"});
                }
                else{
                    newComment.save(function(err){
                        if(err){
                            return res.status(400).json(err);
                        }
                        return res.status(200).json({success: true, msg: 'Successfully posted a comment.'});
                    });
                }
            })
        }
    })
    // .post(authJwtController.isAuthenticated, (req, res) => {
    //     if (!req.body.title || !req.body.username || !req.body.quote) {
    //
    //         res.status(401).send({success: false, msg: 'Include title, username and comment body.'})
    //
    //     }
    //
    //     var newComment = new Comment();
    //
    //     var commentPost = new BlogPost();
    //     commentPost.title = req.body.title;
    //
    //     BlogPost.findOne({ title: commentPost.title }).select('title').exec(function(err, blogpost) {
    //         if (err) {
    //             res.send(err);
    //         }
    //         if (blogpost == null){
    //             return res.json({ success: false, message: 'Comment could not be created. Blog Post not found.'});
    //         }
    //         res.status(200);
    //
    //         newComment.movieId = blogpost._id;
    //         newComment.username = req.user.username;
    //         newComment.review = req.body.review;
    //         newComment.rating = req.body.rating;
    //
    //         newComment.save(function(err) {
    //             if (err) {
    //                 if (err.code == 11000)
    //                     return res.json({ success: false, message: 'A review with that description already exists.'});
    //                 else
    //                     return res.json(err);
    //             }
    //             res.json({success: true, msg: 'Successfully added review.'})
    //         })
    //     });
    // })

    .get(authJwtController.isAuthenticated, function(req, res){ // in getting a review, we print out all comments in the database collection
        Comment.find({}, (err, comments) => {
            if(err)
                return res.status(400).json(err);
            else
                return res.json(comments);
        })
    });

// rejecting requests made to the base url
router.get('/', function (req, res){
        res.send("Invaild path. Page not found.")
    }
);
router.post('/', function (req, res){
        res.send("Invaild path. Page not found.")
    }
);
router.put('/', function (req, res){
        res.send("Invaild path. Page not found.")
    }
);
router.delete('/', function (req, res){
        res.send("Invaild path. Page not found.")
    }
);

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only
