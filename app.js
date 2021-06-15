// required node dependencies
require('dotenv').config()
const express = require("express");
const ejs = require("ejs");
const mongoose = require('mongoose');
const bodyParser = require('body-parser')
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

// express app settings
const app = express();

// ejs files uses css from public folder
app.use(express.static("public"));

// bodyParser
app.use(bodyParser.urlencoded({extended: true}));

// app sets view engine for ejs
app.set('view engine', 'ejs');

// app uses express-session package
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

// app uses passport package
app.use(passport.initialize());
app.use(passport.session());

// user database
mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// mongoose schema for user
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

// used to hash and salt passwords
userSchema.plugin(passportLocalMongoose);

// mongoose User Model
const User = new mongoose.model("User", userSchema);

// sets up serialize and deserialize functions for the user
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

function getLogin(req) {
  if (req.isAuthenticated()) {
    return true;
  }
  return false;
}

app.get("/", function(req, res) {
  res.render("home", {login: getLogin(req)});
});

app.route("/register")
  .get(function(req, res) {
    res.render("register", {errorMsg: "", login: getLogin(req)});
  })
  .post(function(req, res) {

    // if authenticated, logout
    if (req.isAuthenticated()) {
      res.logout("/");
    }

    // retrieves form values
    console.log(req.body);
    const username = req.body.username;
    const password = req.body.password;
    const password2 = req.body.password2;

    // checks if passwords are equal
    if (password === password2) {
      // checks if the username exists creates an account if it doesn't exist
      User.findOne({username: username}, function(err, foundUser) {
        if (err) {
          console.log(err);
          res.render("register", {errorMsg: ""});
        } else if (foundUser) {
          // send error message username already exists
          res.render("register", {errorMsg: "Username already exists", login: getLogin(req)});
        } else {
          // register, authenticate and redirect
          User.register({username: username}, password, function(err, user) {
            if (err) {
              console.log(err);
              res.render("register", {errorMsg: "", login: getLogin(req)});
            } else {
              passport.authenticate("local")(req, res, function(){
                res.redirect("/");
              });
            }
          });
        }
      });
    } else {
      res.render("register", {errorMsg: "Passwords are not same", login: getLogin(req)});
    }
  });

app.get("/creation", function(req, res){
  if (req.isAuthenticated()) {
    res.render("creation", {login: getLogin(req)});
  } else {
    res.render("login", {login: getLogin(req)});
  }
});

app.route("/login")
  .get(function(req, res) {
    if (req.isAuthenticated()) {
      res.redirect("/");
    } else {
      res.render("login", {login: getLogin(req)});
    }
  })
  .post(function(req, res) {
    User.findOne({username: req.body.username}, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else if (foundUser) {
        if (req.isAuthenticated()) {

        }
      } else {
        // Username or Password is wrong
        res.render("login", {errorMsg: "Username or Password is wrong", login: getLogin(req)});
      }
    });
  });

app.get("/logout", function(req, res) {
  req.logout();
  req.session.destroy();
  res.redirect("/");
});


app.listen(3000, function() {
  console.log("Server started on port 3000");
});
