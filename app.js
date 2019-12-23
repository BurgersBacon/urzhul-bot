const config = require('./config');
const Twit = require('twit');
const snoowrap = require('snoowrap');
const Twitter = new Twit(config.mainTwitter);
const TwitterLinks = new Twit(config.sourceTwitter);
const Reddit = new snoowrap(config.reddit);
const http = require('http');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://" + config.mongoDB.username + ":" + config.mongoDB.pass + "@burgersbacon-lvg3y.mongodb.net/urzhul-bot"
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const Imgur = require('./scripts/imgur-api');
const imgurClient = new Imgur(config.imgur);

// connection to database
client.connect(err => {
  console.log("connection succedded!")
  const db = client.db("urzhul-bot");

  listenTwitterMentions(db);

  setInterval(db => {
       runPosting(db);
  }, 7260000, db)
});

// run commands every two hours
const runPosting = (db) => {
  console.log("mmm ok, imma post something");
  getUpvotedPosts(db);
  fetchOnePendingPost(db);
}

// streams everytime the bot @burgrbot gets mentioned
const listenTwitterMentions = (db) => {
  console.log("listening...");
  let stream = Twitter.stream('statuses/filter', { track: ['@burgrbot'] });
  stream.on('tweet', function (tweet) {
    let text = tweet.text;
    console.log(`received mention (${text})`);

    let params = {
      in_reply_to_status_id: tweet.id_str,
      status: `@${tweet.user.screen_name} `
    };

    if (text.includes("!pending")) {

      db.collection("pendingPosts").countDocuments((err, count) => {
        params.status = `${params.status} beep beep boop, pending posts: ${count}`;
        tweetBurgrbot(params);
      });

    } else if (text.includes("!post")) {

      let wordsArray = text.split(" ");
      let postIdPosition = wordsArray.findIndex((word) => word == "!post") + 1
      let postId = wordsArray[postIdPosition]
      if (postId) {
        db.collection("pendingPosts").find({id: postId}).limit(1).toArray().then(posts => {
          if (posts.length > 0) {
            let post = posts[0];
            params.status = `${params.status} yup! i have the post ${post.id} on my folder, im going to let @snaqchat know that you need it!`;
            tweetBurgrbot(params);
            getFormatAndPost(post, db);
          } else {
            params.status = `${params.status} i dont have that post, man, please provide an existent post in my database`;
            tweetBurgrbot(params);
          }
        });
      } else {
        params.status = `${params.status} you did not provided an id, so i guess im gonna pick one, hope you like my selection, master. i mean, beep beep boop! im a dumb bot!`;
        tweetBurgrbot(params);
      }


      // params.status = `${params.status} `;
      // tweetBurgrbot(params);
    } else {
      params.status = params.status + ((tweet.user.screen_name == "valcorn31") ? "miauuuuuu... i mean, woof, i mean beep beep boop im a bot" : "beep beep boop! im a dumb bot, i dont know what you're saying lmaoo");
      tweetBurgrbot(params);
    }

  });
}

// this function post the media to twitter
const fetchOnePendingPost = (db, replying_to) => {
  // gets one of the pending posts
  db.collection("pendingPosts").countDocuments((err, count) => {
    let params;
    if (count < 12 && count % 2 == 1) {
      let params = {
        status: (count == 1) ? `@BurgersBacon no me quiero ir señor stark 😣😭` : `@BurgersBacon beep beep boop, bro im gonna die, i just have ${count} memes, feed me plox 🙏`
      }
      tweetBurgrbot(params);
    }

    var randomNumber = Math.floor(Math.random() * count);
    db.collection("pendingPosts").find().limit(1).skip(randomNumber).toArray().then(posts => {
      let redditPost = posts[0];
      console.log(`beep boop what about this post? ${redditPost.url}`);
      getFormatAndPost(redditPost, db)
    });
  });
}

const getFormatAndPost = (redditPost, db) => {
  console.log(redditPost);
  let httpLink = redditPost.url.replace("https", "http");

  if (isImgur(httpLink)) {
    let httpLinkPartsBySlash = httpLink.split("/");
    let imgurFile = httpLinkPartsBySlash[httpLinkPartsBySlash.length - 1].split(".")
    let imgurId = imgurFile[0];
    console.log(`getting media from imgur.com, media id: ${imgurId}`);
    imgurClient.getImage(imgurId, function(data){
      var jsonResponse = JSON.parse(data);
      let httpLinkParts = jsonResponse.data.link.split(".");
      let fileFormat = httpLinkParts[httpLinkParts.length - 1];
      console.log(jsonResponse, httpLinkParts, fileFormat)
      downloadMedia(jsonResponse.data.link.replace("https", "http"), `images/${redditPost.id}.${fileFormat}`, (urlMedia) => {
        uploadPhotoToTwitter(urlMedia, redditPost, db);
      });
    });
  } else {
    let httpLinkParts = httpLink.split(".");
    let fileFormat = httpLinkParts[httpLinkParts.length - 1];

    switch (fileFormat) {
      case "jpg":
      case "png":
        downloadMedia(httpLink, `images/${redditPost.id}.${fileFormat}`, (urlMedia) => {
          uploadPhotoToTwitter(urlMedia, redditPost, db);
        });
      break;
      // case "vgif":
      //
      //   break;
      default:
        console.log(`i dont know that extention, post: ${posts[0].id}`);
        movePendingPost(db, redditPost, 'unsupportedPosts');
        //runPosting(db);
    }
  }
}

// move an item from pending posts to other table (toTable)
const movePendingPost = (db, redditPost, toTable) => {
  db.collection('pendingPosts').deleteMany({
    id: redditPost.id
  }).then(() => {
    db.collection(toTable).insertOne({
      id: redditPost.id,
      url: redditPost.url,
      permalink: redditPost.permalink,
      author: redditPost.author
    }).then(() => {
      console.log(`beep beep boop, reddit post ${redditPost.id} ${toTable == 'postedPosts' ? 'posted on Twitter!' : 'archived on database!'}`)
    });
  });
}

// it searchs my upvoted posts on Reddit and saves some data to post them later
const getUpvotedPosts = (db) => {
  Reddit._get({uri: 'user/l33t_supa_h4x0r_/upvoted?limit=100'}).then(redditPosts => {
    let newPosts = [];
    // this part of the code searchs in the database and creates an array (pendingPosts)
    db.collection("pendingPosts").find().toArray().then(pendingPosts => {
      let savedItems = 0;
      redditPosts.forEach(redditPost => {

          // searchs the reddit post inside pendingPosts
          let found = pendingPosts.find(pendingPost => {
            return redditPost.id == pendingPost.id;
          });
          if (!found) {
            // searchs the redditPost inside postedPosts (to not post it again)
            db.collection("postedPosts").findOne({
              id: redditPost.id
            }).then(postedPost => {
              if (!postedPost) {
                db.collection("pendingPosts").insertOne({
                  id: redditPost.id,
                  url: redditPost.url,
                  permalink: redditPost.permalink,
                  author: redditPost.author.name
                })
                .then(() => {
                  savedItems ++;
                })
                .catch(err => {
                  if (err) console.log(err)
                });
              } else {
              }
            });
          }
        });
        if (savedItems > 0) {
          let msg = `${savedItems} new items saved into database`
          console.log(msg)
          tweetBurgrbot({status: msg})
        }
    });
  });
}

// posts the tweet(?)
const tweetUrzhul = (params, redditPost, db) => {
  Twitter.post('statuses/update', params, function(err, data, response) {
    let paramsForReply = {
      in_reply_to_status_id: data.id_str,
      status: `.@${data.user.screen_name} st0len from: https://reddit.com${redditPost.permalink}, posted (probably st0len too) by: /u/${redditPost.author}, via Reddit.`
    }
    tweetBurgrbot(paramsForReply, redditPost, db);
  })
}

const tweetBurgrbot = (paramsForReply, redditPost, db) => {
  TwitterLinks.post('statuses/update', paramsForReply, function(err, data, response) {
    if (redditPost) {
      movePendingPost(db, redditPost, 'postedPosts');
    } else {
      console.log("replied to someone");
    }
  });
}

// donwloads the media to the server
const downloadMedia = (url, dest, cb) => {
  let file = fs.createWriteStream(dest);
  let request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb(dest));
    });
  });
}

// just read the name of the function
const uploadPhotoToTwitter = (urlImage, redditPost, db) => {
  let b64content = fs.readFileSync(urlImage, { encoding: 'base64' });
  Twitter.post('media/upload', { media_data: b64content }, function (err, data, response) {
    let mediaIdStr = data.media_id_string
    let meta_params = { media_id: mediaIdStr}
    Twitter.post('media/metadata/create', meta_params, function (err, data, response) {
      if (!err) {
        let params = { status: '', media_ids: [mediaIdStr] }
        tweetUrzhul(params, redditPost, db);
      }
    })
  });
}

const isImgur = (url) => {
  return url.includes("imgur");
}
