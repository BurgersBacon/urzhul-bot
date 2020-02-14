const config = require('../config');

// Reddit API configuration
const snoowrap = require('snoowrap');
const Reddit = new snoowrap(config.reddit);

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
      console.log(`beep beep boop, reddit post ${redditPost.id} ${toTable == 'postedPosts' ? 'posted on Twitter!' : 'archived on database!'}`);
    });
  });
};

// this function post the media to twitter
const fetchOnePendingPost = (db, botActions) => {
  // count left pending posts
  db.collection("pendingPosts").countDocuments((err, count) => {
    watchEnoughPendingPosts(count, botActions);
    // gets one random pending post
    let randomNumber = Math.floor(Math.random() * count);
    db.collection("pendingPosts").find().limit(1).skip(randomNumber).toArray().then(posts => {
      let redditPost = posts[0];
      console.log(`beep boop what about this post? ${redditPost.url}`);
      botActions.getFormatAndPost(redditPost, db);
    });
  });
};

// checks if there are enough pending posts, if not, let @BurgersBacon know
const watchEnoughPendingPosts = (count, botActions) => {
  if (count < 12 && count % 2 == 1) {
    let params = {
      status: (count == 1) ? `@BurgersBacon no me quiero ir señor stark 😣😭` : `@BurgersBacon beep beep boop, bro im gonna die, i just have ${count} memes, feed me plox 🙏`
    };
    botActions.tweetBurgrbot(params);
  }
};

// it searchs my upvoted posts on Reddit and saves some data to post them later
const getUpvotedPosts = (db, botActions) => {
  Reddit._get({uri: 'user/l33t_supa_h4x0r_/upvoted?limit=100'}).then(redditPosts => {
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
                  if (err) console.log(err);
                });
              }
            });
          }
        });
        if (savedItems > 0) {
          let msg = `${savedItems} new items saved into database`;
          console.log(msg);
          botActions.tweetBurgrbot({status: msg});
        }
    });
  });
};

module.exports.getUpvotedPosts = getUpvotedPosts;
module.exports.movePendingPost = movePendingPost;
module.exports.fetchOnePendingPost = fetchOnePendingPost;
