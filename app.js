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

mongoose.connect(process.env.MONGO_SERVER, {
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
    return req.user.username;
  }
  return "";
}

// homepage route handler
app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/latest");
  } else {
    res.render("home", {
      username: getLogin(req)
    });
  }
});

// login page route handler
app.route("/login")
  .get(function(req, res) {
    if (req.isAuthenticated()) {
      res.redirect("/latest");
    } else {
      res.render("login", {
        errorMsg: "",
        username: getLogin(req)
      });
    }
  })
  .post(function(req, res) {
    // check the DB to see if the username that was used to login exists in the DB
    User.findOne({
      username: req.body.username
    }, function(err, foundUser) {
      // if username is found in the database, create an object called "user" that will store the username and password
      // that was used to login
      if (foundUser) {
        const user = new User({
          username: req.body.username,
          password: req.body.password
        });
        // use the "user" object that was just created to check against the username and password in the database
        // in this case below, "user" will either return a "false" boolean value if it doesn't match, or it will
        // return the user found in the database
        passport.authenticate("local", function(err, user) {
          if (err) {
            console.log(err);
          } else {
            // this is the "user" returned from the passport.authenticate callback, which will be either
            // a false boolean value if no it didn't match the username and password or
            // a the user that was found, which would make it a truthy statement
            if (user) {
              // if true, then log the user in, else redirect to login page
              req.login(user, function(err) {
                res.redirect("/latest");
              });
            } else {
              res.redirect("/login");
            }
          }
        })(req, res);
        // if no username is found at all, redirect to login page.
      } else {
        // user does not exists
        res.redirect("/login")
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
      username: getLogin(req)
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
            errorMsg: "",
            username: getLogin(req)
          });
        } else if (foundUser) {
          // sends error message that username already exists
          res.render("register", {
            errorMsg: "Username already exists",
            username: getLogin(req)
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
                username: getLogin(req)
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
        username: getLogin(req)
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
        username: getLogin(req)
      });
    } else {
      res.redirect("/login");
    }
  })
  .post(function(req, res) {
    if (req.isAuthenticated()) {
      let formDataList = Object.values(req.body); // turn the form values into an array
      const title = formDataList.shift();
      let cardList = []; // empty array for the term - definition pairs
      for (let i = 0; i < formDataList.length; i += 2) {
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

      // studySet.save();

      // push studySet to user
      User.updateOne({
          _id: req.user.id
        }, {
          $push: {
            studySets: studySet
          }
        },
        function(err) {
          if (err) {
            console.log(err);
          } else {
            console.log(req.user.id, " Succesfully created User studyset");
          }
        });

      res.render("studyset", {
        studySet: studySet,
        username: req.user.username,
        author: req.user.username,
      });
    } else {
      res.redirect("/login");
    }
  });

// studyset route handler
app.route("/studyset/:username/:title")
  .get(function(req, res) {
    let author = req.params.username;
    let title = req.params.title;

    User.findOne({
      username: author
    }, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else if (foundUser) {
        let studySet = foundUser.studySets.filter(obj => {
          return obj.title === title;
        });
        if (studySet.length !== 0) {
          let deleteAuth = true;
          let username = "";
          if (req.isAuthenticated()) {
            username = req.user.username;
          }
          res.render("studyset", {
            author: author,
            studySet: studySet[0],
            username: username
          });

        } else {
          res.redirect("/");
        }
      } else {
        res.redirect("/");
      }
    });
  })
  .post(function(req, res) {

  });

// edit studySet handler
app.route("/edit/:username/:title")
  .get(function(req, res) {
    let author = req.params.username;
    let title = req.params.title;
    if (req.isAuthenticated() && req.user.username === author) {
      User.findOne({
        username: author
      }, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else if (foundUser) {
          let studySet = foundUser.studySets.filter(obj => {
            return obj.title === title;
          });
          if (studySet.length !== 0) {
            res.render("edit", {
              studySet: studySet[0],
              username: author
            });
          } else {
            res.redirect("/");
          }
        }
      });
    } else {
      res.redirect("/");
    }
  })
  .post(function(req, res) {
      let author = req.params.username;
      let prevTitle = req.params.title;

      if (req.isAuthenticated() && req.user.username === author) {
        let formDataList = Object.values(req.body); // turn the form values into an array
        const formtitle = formDataList.shift();
        let cardList = []; // empty array for the term - definition pairs
        for (let i = 0; i < formDataList.length; i += 2) {
          if (formDataList[i] != '' && formDataList[i + 1] != '') {
            cardList.push({
              "term": formDataList[i],
              "termDef": formDataList[i + 1]
            });
          }
        }

        // create updated StudySet
        const studySet = new StudySet({
          title: formtitle,
          flashCards: cardList
        });

        User.updateOne({
            username: author,
            "studySets": { "$elemMatch": { "title": prevTitle } }
          }, {
            "$set": { "studySets.$": studySet }
          }, function(err, foundUser) {
            if (err) {
              console.log(err);
            } else if (foundUser) {
              res.redirect("/");
            }
          });
        } else {
          res.redirect("/");
        }
  });

// delete studySet handler
app.post("/delete", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.username === req.body.username) {
      let setId = mongoose.Types.ObjectId(req.body.studySetId);
      console.log(setId);
      User.updateOne({
          username: req.body.username
        }, {
          $pull: {
            studySets: {
              title: req.body.studySetTitle
            }
          }
        },
        function(err, foundUser) {
          if (err) {
            console.log(err);
          } else {
            console.log("Successful deletion of set from user: ", foundUser);
          }
        });

      res.redirect("/latest");
    }
  } else {
    res.redirect("/login");
  }
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server started successfuly.");
});
