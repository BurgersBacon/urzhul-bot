const config = require('./config');
const Twit = require('twit');
const snoowrap = require('snoowrap');
const Twitter = new Twit(config.mainTwitter);
const TwitterLinks = new Twit(config.sourceTwitter);
const Reddit = new snoowrap(config.reddit);
const http = require('http');
const fs = require('fs');

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://burgersbacon:ayylmao@burgersbacon-lvg3y.mongodb.net/urzhul-bot"
const client = new MongoClient(uri, { useNewUrlParser: true });


client.connect(err => {
  const db = client.db("urzhul-bot");

  setInterval(db => {
    getUpvotedPosts(db);
    postMedia(db);
  }, 60000, db)
});



const postMedia = (db) => {
  db.collection("pendingPosts").find().sort({id: -1}).limit(1).toArray().then(posts => {
    var httpLink = posts[0].url.replace("https", "http");
    downloadMedia(httpLink, `images/${posts[0].id}`, (urlMedia) => {
      postPhoto(urlMedia, posts[0], db);
    });
  })
}


const getUpvotedPosts = (db) => {
  Reddit._get({uri: 'user/l33t_supa_h4x0r_/upvoted/'}).then(redditPosts => {

    let newPosts = [];

    db.collection("pendingPosts").find().toArray().then(pendingPosts => {
      redditPosts.forEach(redditPost => {

          let found = pendingPosts.find(pendingPost => {
            return pendingPost.id == redditPost.id;
          });
          if (!found) {
            console.log("FOUND")
            db.collection("postedPosts").findOne({
              id: redditPost.id
            }).then(lmao => {
              if (!lmao) {
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
                  if (err) console.log("AHHHHHHAHAHAHHH")
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
        console.log(redditPost.id)
        db.collection("postedPosts").insertOne({
          id: redditPost.id,
          url: redditPost.url,
          permalink: redditPost.permalink,
          author: redditPost.author
        }).then(() => {
          console.log("-------")
        });
      })
    });
  })
}



const downloadMedia = (url, dest, cb) => {
  let file = fs.createWriteStream(dest);
  let request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb(dest));
    });
  });
}

const postPhoto = (urlImage, redditPost, db) => {

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
