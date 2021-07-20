// required node dependencies
require('dotenv').config()
const express = require("express");
const ejs = require("ejs");
const mongoose = require('mongoose');
const bodyParser = require('body-parser')
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const app = express();

app.use(express.static("public"));

app.use(bodyParser.urlencoded({
  extended: true
}));

app.set('view engine', 'ejs');

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const studySetSchema = new mongoose.Schema({
  title: String,
  flashCards: [{
    term: String,
    termDef: String
  }]
});

const StudySet = mongoose.model("StudySet", studySetSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  studySets: [studySetSchema]
});

userSchema.plugin(passportLocalMongoose);

// mongoose User Model
const User = new mongoose.model("User", userSchema);

// sets up serialize and deserialize functions for the user
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// function that returns a boolean if the request is authenticated
function getLogin(req) {
  if (req.isAuthenticated()) {
    return true;
  }
  return false;
}

// GET method route for homepage
app.get("/", function(req, res) {
  res.render("home", {
    login: getLogin(req)
  });
});

// login page route handler
app.route("/login")
  .get(function(req, res) {
    if (req.isAuthenticated()) {
      res.redirect("/latest");
    } else {
      res.render("login", {
        errorMsg: "",
        login: getLogin(req)
      });
    }
  })
  .post(function(req, res) {
    User.findOne({
      username: req.body.username
    }, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else if (foundUser) {
        // login and authenticate
        passport.authenticate("local")(req, res, function() {
          res.redirect("/latest");
        });
      } else {
        // renders error Username or Password is wrong
        res.render("login", {
          errorMsg: "Username or Password is wrong",
          login: getLogin(req)
        });
      }
    });
  });

// logout page handler
app.get("/logout", function(req, res) {
  req.logout();
  req.session.destroy();
  res.redirect("/");
});

// register account page route handler
app.route("/register")
  .get(function(req, res) {
    res.render("register", {
      errorMsg: "",
      login: getLogin(req)
    });
  })
  .post(function(req, res) {
    // if authenticated, logout
    if (req.isAuthenticated()) {
      res.logout("/");
    }

    const username = req.body.username;
    const password = req.body.password;
    const password2 = req.body.password2;

    if (password === password2) {
      // find if the username exists
      User.findOne({
        username: username
      }, function(err, foundUser) {
        if (err) {
          console.log(err);
          res.render("register", {
            errorMsg: ""
          });
        } else if (foundUser) {
          // sends error message that username already exists
          res.render("register", {
            errorMsg: "Username already exists",
            login: getLogin(req)
          });
        } else {
          // registers user, authenticates and redirect to latest page
          User.register({
            username: username
          }, password, function(err, user) {
            if (err) {
              console.log(err);
              res.render("register", {
                errorMsg: "",
                login: getLogin(req)
              });
            } else {
              passport.authenticate("local")(req, res, function() {
                res.redirect("/latest");
              });
            }
          });
        }
      });
    } else {
      // sends error message if passwords not same
      res.render("register", {
        errorMsg: "Passwords are not same",
        login: getLogin(req)
      });
    }
  });

// latest page route handler, shows user's created studysets
app.route("/latest")
  .get(function(req, res) {
    if (req.isAuthenticated()) { // authenticated request required
      User.findOne({ // finds the user
        username: req.user.username
      }, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          res.render("latest", {
            studySets: foundUser.studySets,
            login: getLogin(req),
            username: foundUser.username
          });
        }
      });
    } else { // redirect to login page
      res.redirect("/login");
    }
  });

// creation page for studyset route handler
app.route("/creation")
  .get(function(req, res) {
    if (req.isAuthenticated()) {
      res.render("creation", {
        login: getLogin(req)
      });
    } else {
      res.render("login", {
        errorMsg: "",
        login: getLogin(req)
      });
    }
  })
  .post(function(req, res) {
    if (req.isAuthenticated()) {
      let formDataList = Object.values(req.body); // turn the form values into an array
      const title = formDataList.shift();
      let cardList = []; // empty array for the term - definition pairs
      for (let i = 0; i < formDataList.length; i+=2) {
        if (formDataList[i] != '' && formDataList[i + 1] != '') {
          cardList.push({
            "term": formDataList[i],
            "termDef": formDataList[i + 1]
          });
        }
      }

      // create StudySet
      const studySet = new StudySet({
        title: title,
        flashCards: cardList
      });

      studySet.save();

      // push studySet to user
      User.updateOne(
        { _id: req.user.id },
        { $push: {studySets: studySet} },
        function(err){
          if (err) {
            console.log(err);
          } else {
            console.log(req.user.id, " Succesfully updated User studyset");
          }
        });

      res.render("studyset", {
        studySet: studySet,
        login: getLogin(req)
      });
    } else {
      res.render("login", {
        errorMsg: "",
        login: getLogin(req)
      });
    }
  });

// studyset route handler
app.route("/studyset/:username/:title")
  .get(function(req, res) {
    let username = req.params.username;
    let title = req.params.title;

    User.findOne({ username: username }, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else if (foundUser) {
          let studySet = foundUser.studySets.filter(obj => {
            return obj.title === title;
          });
          if (studySet.length !== 0) {
            res.render("studyset", {
              studySet: studySet[0],
              login: getLogin(req)
            });
          } else {
            res.redirect("/");
          }
        } else {
          res.redirect("/");
        }
      });
  });

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
