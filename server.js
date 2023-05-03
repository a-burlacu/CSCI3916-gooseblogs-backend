var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./BlogPost');
var Review = require('./Comment');

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

// movie parameter routes where we also check review query
router.route('/movies/*')
    .get(authJwtController.isAuthenticated, function(req, res){ // on GET, get the specific movie based off the param
        Movie.findOne({title: req.params['0']}, function(err, movie){
            if(err) {
                return res.status(400).json(err);
            }
            else if(!movie){
                return res.status(400).json({success: false, msg: "Movie does not exist!"});
            }
            else{
                if(req.query.reviews === "true"){ // checking the review query param
                    Movie.aggregate([ // using the $match and $lookup aggregation methods, we can join the reviews collection for a specific movie
                        {
                            $match: {
                                title: req.params['0']
                            }
                        },
                        {
                            $lookup: {
                                from: "reviews",
                                localField: "title",
                                foreignField: "movieID",
                                as: "movieReviews"
                            }
                        },
                        {
                            // get the average rating as a new field on the aggregate
                            $addFields:
                                {
                                    avgRating: {$avg: "$movieReviews.rating"}
                                }

                        },
                        {
                            $sort:
                                {
                                    avgRating: -1
                                }
                        }
                    ]).exec(function(err, movieReviews){
                        if(err){
                            return res.status(400).json(err)
                        }
                        else {
                            return res.status(200).json(movieReviews);
                        }
                    })
                }
                else{ // if reviews=false, we just return the movie
                    return res.status(200).json(movie);
                }
            }
        })
    })
    .put(authJwtController.isAuthenticated, function(req, res){
        let update = req.body;
        Movie.findOneAndUpdate({title: req.params['0']}, update, {new: true}, function(err, data){
            if(err){
                return res.status(400).json(err);
            }
            else{
                return res.status(200).json(data);
            }
        })
    })
    .post(authJwtController.isAuthenticated, function(req, res){
        return res.status(400).send({success: false, msg: 'POST Denied on /movieparameter'});
    })
    // for DELETE, delete a movie
    .delete(authJwtController.isAuthenticated, function(req, res){
        Movie.deleteOne({title: req.params['0']}, null, function(err, data){
            if(err){
                return res.status(400).json(err);
            }
            else{
                return res.status(200).json({success: true, msg: 'Movie is deleted!'});
            }
        });
    })

// movie routes with review query
router.route('/movies')
    .delete(authJwtController.isAuthenticated, function(req, res){ // fail on the /movies DELETE
            return res.status(400).send({success: false, msg: 'DELETE Denied on /movies'});
        }
    )
    .put(authJwtController.isAuthenticated, function(req, res){ // fail on the /movies PUT
            return res.status(400).send({success: false, msg: 'PUT Denied on /movies'});
        }
    )
    .get(authJwtController.isAuthenticated, function(req, res){ // in GET, we want to return all movies in the collection
            Movie.find({}, (err, movies) => {
                if(err)
                    return res.status(400).json(err);
                else{
                    if(req.query.reviews === "true"){ // checking the review query param
                        Movie.aggregate([ // using the $lookup aggregation method, we can join the reviews collection for all movies
                            {
                                $lookup: {
                                    from: "reviews",
                                    localField: "title",
                                    foreignField: "movieID",
                                    as: "movieReviews"
                                }
                            },
                            {
                                // get the average rating as a new field on the aggregate
                                $addFields:
                                    {
                                        avgRating: {$avg: "$movieReviews.rating"}
                                    }
                            },
                            {
                                $sort:
                                    {
                                        avgRating: -1
                                    }
                            }
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
                        return res.json(movies); // otherwise, if reviews=false, we just return all movies
                    }
                }
            })
        }
    )
    .post(authJwtController.isAuthenticated,function(req, res) { // in POST, we want to save a single movie
            let newMovie = new Movie();
            newMovie.title = req.body.title;
            newMovie.year = req.body.year;
            newMovie.genre = req.body.genre;
            newMovie.actors = req.body.actors;
            newMovie.imageUrl = req.body.imageUrl;

            if(newMovie.title === "" || newMovie.year === "" || newMovie.genre === "" || // error checking
                newMovie.actors === ""){
                return res.status(400).send({success: false, msg: "Cannot save a new movie object that does not have all required fields."});
            }
            else if(newMovie.actors.length < 3){
                return res.status(400).send({success: false, msg: "Cannot save a new movie object without at least 3 actors."})
            }
            else{
                newMovie.save(function(err){
                    if(err) {
                        if (err.code == 11000)
                            return res.status(400).json({success: false, message: 'This movie already exists!'});
                        else
                            return res.json(err);
                    }
                    return res.status(200).json({success: true, msg: 'Successfully saved new movie.'});
                });
            }
        }
    );

// review route for posting a review, and getting all reviews
router.route('/review')
    .post(authJwtController.isAuthenticated,function(req, res){ // in posting a review, we get info from the req body and do error checking
        let newReview = new Review();
        newReview.movieID = req.body.movieID;
        newReview.name = req.body.name;
        newReview.quote = req.body.quote;
        newReview.rating = req.body.rating;

        if(newReview.movieID === "" || newReview.name === "" || newReview.rating === "" || newReview.rating <= 0 || newReview.rating > 5){
            return res.status(400).send({success: false, msg: "Cannot post a review without the name of the movie, the name of the reviewer, and a rating of 1-5 stars."});
        }
        else{
            Movie.findOne({title: newReview.movieID}, function(err, movie){ // find if movie even exists first
                if(err) {
                    return res.status(400).json(err);
                }
                else if(!movie){
                    return res.status(400).json({success: false, msg: "Movie does not exist!"});
                }
                else{
                    newReview.save(function(err){
                        if(err){
                            return res.status(400).json(err);
                        }
                        return res.status(200).json({success: true, msg: 'Successfully posted a review.'});
                    });
                }
            })
        }
    })
    .get(authJwtController.isAuthenticated, function(req, res){ // in getting a review, we print out all reviews in the database collection
        Review.find({}, (err, reviews) => {
            if(err)
                return res.status(400).json(err);
            else
                return res.json(reviews);
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
