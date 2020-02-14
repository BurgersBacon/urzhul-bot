const config = require('../config');

// requirements to download files
const http = require('http');
const fs = require('fs');

// Twitter and Imgur API configuration
const Twit = require('twit');
const Imgur = require('./imgur-api');
const Twitter = new Twit(config.mainTwitter);
const TwitterLinks = new Twit(config.sourceTwitter);
const imgurClient = new Imgur(config.imgur);

// calling database actions module
const databaseActions = require('./database-actions');

// burgrbot tweets what is received on params
const tweetBurgrbot = (params, redditPost, db) => {
  TwitterLinks.post('statuses/update', params, function(err) {
    if (err) {
      console.log(err);
    } else {
      if (redditPost) {
        databaseActions.movePendingPost(db, redditPost, 'postedPosts');
      } else {
        console.log("replied to someone (burgrbot)");
      }
    }
  });
};

// Urzhúl-bot tweets what is received on params
const tweetUrzhul = (params, redditPost, db) => {
  console.log(params, redditPost);
  Twitter.post('statuses/update', params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      if (redditPost) {
        let paramsForReply = {
          in_reply_to_status_id: data.id_str,
          status: `.@${data.user.screen_name} st0len from: https://reddit.com${redditPost.permalink}, posted (probably st0len too) by: /u/${redditPost.author}, via Reddit.`
        };
        tweetBurgrbot(paramsForReply, redditPost, db);
      } else {
        console.log("replied to someone (urzhul)");
      }
    }
  });
};

// when executed, burgrbot starts listening mentions
const listenBurgrbot = (db) => {
  console.log("burgrbot is listening...");
  let streamBurgrbot = TwitterLinks.stream('statuses/filter', { track: ['@burgrbot'] });
  // every time someone mentions @burgrbot in a tweet
  streamBurgrbot.on('tweet', function (tweet) {
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
      let postIdPosition = wordsArray.findIndex((word) => word == "!post") + 1;
      let postId = wordsArray[postIdPosition];
      if (postId) {
        postOne(db, postId, params);
      } else {
        params.status = `${params.status} you did not provided an id, so i guess im gonna pick one, hope you like my selection, master. i mean, beep beep boop! im a dumb bot!`;
        tweetBurgrbot(params);
      }
    } else {
      params.status = params.status + ((tweet.user.screen_name == "valcorn31") ? "miauuuuuu... i mean, woof, i mean beep beep boop im a bot" : "beep beep boop! im a dumb bot, i dont know what you're saying lmaoo");
      tweetBurgrbot(params);
    }
  });
};

// when executed, Urzhúl-bot starts listening mentions
const listenUrzhul = () => {
  console.log("Urzhúl is listening...");
  let streamUrzhul = Twitter.stream('statuses/filter', { track: ['@snaqchat'] });
  streamUrzhul.on('tweet', function (tweet) {
    let text = tweet.text;
    if (tweet.user.screen_name !== 'burgrbot') {
      console.log(`received mention (${text})`);
      let params = {
        in_reply_to_status_id: tweet.id_str,
        status: `@${tweet.user.screen_name} `
      };
      params.status = `${params.status} beep beep boop! im a dumb bot, i dont know what you're saying lmaoo`;
      tweetUrzhul(params);
    }
  });
};

// donwloads the media to the server
const downloadMedia = (url, dest, cb) => {
  let file = fs.createWriteStream(dest);
  http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb(dest));
    });
  });
};

// just read the name of the function
const uploadPhotoToTwitter = (urlImage, redditPost, db) => {
  console.log("uploading photo to twitter");
  console.log(urlImage);

  let b64content = fs.readFileSync(urlImage, { encoding: 'base64' });
  Twitter.post('media/upload', { media_data: b64content }, function (err, data) {
    if (err) {
      console.log(err);
    } else {
      let mediaIdStr = data.media_id_string;
      let meta_params = { media_id: mediaIdStr};
      Twitter.post('media/metadata/create', meta_params, function (err) {
        if (!err) {
          let params = { status: '', media_ids: [mediaIdStr] };
          tweetUrzhul(params, redditPost, db);
        }
      });
    }
  });
};

// const uploadVideoToTwitter = (urlImage, redditPost, db) => {
//   console.log("uploading video to twitter");
//   console.log(urlImage);
//   Twitter.postMediaChunked({ file_path: urlImage }, function (err, data, response) {
//     console.log(err, data);
//     if (err) {
//       console.log(err);
//     }
//     // if (mediaId) {
//     //     // wait until uploaded video is processed
//     //     let processingInfo = res.processing_info;
//     //     while (processingInfo.state==='pending') {
//     //       console.log("????")
//     //         yield Promise.delay(processingInfo.check_after_secs * 1000);
//     //         let res = yield req.twitter.get('/media/upload', {
//     //             command: 'STATUS',
//     //             media_id: mediaId
//     //         });
//     //         processingInfo = res.data.processing_info;
//     //     }
//     //     let mediaIdStr = data.media_id_string;
//     //     let meta_params = { media_id: mediaIdStr};
//     //     Twitter.post('media/metadata/create', meta_params, function (err) {
//     //       if (!err) {
//     //         let params = { status: '', media_ids: [mediaIdStr] };
//     //         console.log("asdas", redditPost)
//     //         tweetUrzhul(params, redditPost, db);
//     //       }
//     //     });
//     // }
//
//   });
// };

// depending on the format, it changes the way to upload the media
const handleFormatAndPost = ( db, redditPost, httpLink, fileFormat ) => {
  switch ( fileFormat ) {
    case "jpg":
    case "png":
      downloadMedia(httpLink, `images/${redditPost.id}.${fileFormat}`, (urlMedia) => {
        uploadPhotoToTwitter(urlMedia, redditPost, db);
      });
    break;
    case "mp4":
      downloadMedia(httpLink, `images/${redditPost.id}.${fileFormat}`, () => {
        //uploadVideoToTwitter(urlMedia, redditPost, db);
      });
    break;
    default:
      console.log(`i dont know that extention, post: ${redditPost.id}`);
      databaseActions.movePendingPost(db, redditPost, 'unsupportedPosts');
      //runPosting(db);
  }
};

// checks the format of the file and then posts it
const getFormatAndPost = (redditPost, db) => {
  let httpLink = redditPost.url.replace("https", "http");
  if (isImgur(httpLink)) {
    let httpLinkPartsBySlash = httpLink.split("/");
    let imgurFile = httpLinkPartsBySlash[httpLinkPartsBySlash.length - 1].split(".");
    let imgurId = imgurFile[0];
    console.log(`getting media from imgur.com, media id: ${imgurId}`);
    imgurClient.getImage(imgurId, function(data){
      console.log("start posting");
      var jsonResponse = JSON.parse(data);
      let httpLinkParts = jsonResponse.data.link.split(".");
      let fileFormat = httpLinkParts[httpLinkParts.length - 1];
      console.log(fileFormat);
      handleFormatAndPost(db, redditPost, httpLink, fileFormat);
    });
  } else {
    let httpLinkParts = httpLink.split(".");
    let fileFormat = httpLinkParts[httpLinkParts.length - 1];
    handleFormatAndPost(db, redditPost, httpLink, fileFormat);
  }
};

// posts one specified post
const postOne = (db, postId, params) => {
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
};

// checks if the url is from http://imgur.com
const isImgur = (url) => {
  return url.includes("imgur");
};

module.exports.listenBurgrbot = listenBurgrbot;
module.exports.listenUrzhul = listenUrzhul;
module.exports.getFormatAndPost = getFormatAndPost;
