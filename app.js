const config = require('./config');
const Twit = require('twit');
const snoowrap = require('snoowrap');
const Twitter = new Twit(config.mainTwitter);
const TwitterLinks = new Twit(config.sourceTwitter);
const Reddit = new snoowrap(config.reddit);
const http = require('http');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://" + process.env.MONGODB_USERNAME + ":" + process.env.MONGODB_PASSWORD + "@burgersbacon-lvg3y.mongodb.net/urzhul-bot"
const client = new MongoClient(uri, { useNewUrlParser: true });

// connection to database
client.connect(err => {
  console.log("connection succedded!")
  const db = client.db("urzhul-bot");
  // every two hours do:
  //setInterval(db => {
      console.log("mmm ok, imma post something")
      getUpvotedPosts(db);
      fetchOnePendingPost(db);
   //}, 7260000, db)
});

// this function post the media to twitter
const fetchOnePendingPost = (db) => {
  // gets one of the pending posts
  db.collection("pendingPosts").find().sort({id: -1}).limit(1).toArray().then(posts => {
    console.log("beep boop what about this post? " + posts[0].url)
    var httpLink = posts[0].url.replace("https", "http");
    downloadMedia(httpLink, `images/${posts[0].id}`, (urlMedia) => {
      postPhoto(urlMedia, posts[0], db);
    });
  })
}

// it searchs my upvoted posts on Reddit and saves some data to post them later
const getUpvotedPosts = (db) => {
  Reddit._get({uri: 'user/l33t_supa_h4x0r_/upvoted/'}).then(redditPosts => {
    let newPosts = [];
    // this part of the code searchs in the database and creates an array (pendingPosts)
    db.collection("pendingPosts").find().toArray().then(pendingPosts => {
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
                  console.log("added to database")
                })
                .catch(err => {
                  if (err) console.log(err)
                });
              } else {
                console.log("ya esta posteado shavo")
              }
            });
          }
        });
    });
  });
}

// posts the tweet(?)
const postTweet = (params, redditPost, db) => {
  Twitter.post('statuses/update', params, function(err, data, response) {
    let paramsForReply = {
      in_reply_to_status_id: data.id_str,
      status: `@${data.user.screen_name} stolen from: https://reddit.com${redditPost.permalink}, posted (probably stolen too) by: /u/${redditPost.author}, via Reddit`
    }
    TwitterLinks.post('statuses/update', paramsForReply, function(err, data, response) {
      db.collection('pendingPosts').deleteMany({
        id: redditPost.id
      }).then(() => {
        db.collection("postedPosts").insertOne({
          id: redditPost.id,
          url: redditPost.url,
          permalink: redditPost.permalink,
          author: redditPost.author
        }).then(() => {
          console.log(`beep beep boop, reddit post ${redditPost.id} posted on twitter!`)
        });
      })
    });
  })
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
  var b64content = fs.readFileSync(urlImage, { encoding: 'base64' });
  Twitter.post('media/upload', { media_data: b64content }, function (err, data, response) {
    var mediaIdStr = data.media_id_string
    var meta_params = { media_id: mediaIdStr}
    Twitter.post('media/metadata/create', meta_params, function (err, data, response) {
      if (!err) {
        var params = { status: '', media_ids: [mediaIdStr] }
        postTweet(params, redditPost, db);
      }
    })
  });
}
