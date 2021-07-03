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
app.use(bodyParser.urlencoded({
  extended: true
}));

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

// schema for studySet
const studySetSchema = new mongoose.Schema({
  title: String,
  flashCards: [{
    term: String,
    termDef: String
  }]
});

const StudySet = mongoose.model("StudySet", studySetSchema);

// mongoose schema for user
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  studySets: [studySetSchema]
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
  res.render("home", {
    login: getLogin(req)
  });
});

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

    // retrieves form values
    console.log(req.body);
    const username = req.body.username;
    const password = req.body.password;
    const password2 = req.body.password2;

    // checks if passwords are equal
    if (password === password2) {
      // checks if the username exists creates an account if it doesn't exist
      User.findOne({
        username: username
      }, function(err, foundUser) {
        if (err) {
          console.log(err);
          res.render("register", {
            errorMsg: ""
          });
        } else if (foundUser) {
          // send error message username already exists
          res.render("register", {
            errorMsg: "Username already exists",
            login: getLogin(req)
          });
        } else {
          // register, authenticate and redirect
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
      res.render("register", {
        errorMsg: "Passwords are not same",
        login: getLogin(req)
      });
    }
  });

// page for logged in users, shows their studysets
app.route("/latest")
  .get(function(req, res) {
    if (req.isAuthenticated()) {
      console.log(req.user);
      User.findOne({
        username: req.user.username
      }, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          res.render("latest", {
            studySets: foundUser.studySets,
            login: getLogin(req)
          });
        }
      });
    } else {
      res.redirect("/login");
    }
  });


// page for creating study sets
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

      let data = Object.values(req.body);

      const title = data.shift();
      let cardList = [];
      for (let i = 0; i < data.length; i+=2) {
        if (data[i] != '' && data[i + 1] != '') {
          // add to list
          cardList.push({
            "term": data[i],
            "termDef": data[i + 1]
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
            console.log("Succesfully updated User studyset");
            console.log(req.user.id);
          }
        });

      // redirect to newly created studySet

      //res.send(cardList);

      res.render("studyset", {
        cardList: cardList,
        login: getLogin(req)
      });

    } else {
      res.render("login", {
        errorMsg: "",
        login: getLogin(req)
      });
    }
  });



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
        // Username or Password is wrong
        res.render("login", {
          errorMsg: "Username or Password is wrong",
          login: getLogin(req)
        });
      }
    });
  });


// STUDYSET




app.get("/logout", function(req, res) {
  req.logout();
  req.session.destroy();
  res.redirect("/");
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
