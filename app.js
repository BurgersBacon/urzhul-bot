const config = require('./config');
const Twit = require('twit');
const snoowrap = require('snoowrap');
const Twitter = new Twit(config.mainTwitter);
const TwitterLinks = new Twit(config.sourceTwitter);
const Reddit = new snoowrap(config.reddit);
const http = require('http');
const fs = require('fs');

const postTweet = (params, redditPost) => {
  Twitter.post('statuses/update', params, function(err, data, response) {
    console.log(data, data.id, redditPost);

    let paramsForReply = {
      in_reply_to_status_id: data.id,
      status: `@${data.user.screen_name} stolen from: https://reddit.com${redditPost.permalink}, posted (probably stolen too) by: /u/${redditPost.author.name}, via Reddit`
    }

    TwitterLinks.post('statuses/update', paramsForReply);
  })
}

const getUpvotedPosts = () => {
  Reddit._get({uri: 'user/l33t_supa_h4x0r_/upvoted/'}).then(posts => {
    var httpLink = posts[0].url.replace("https", "http");
    downloadMedia(httpLink, `images/${posts[0].id}`, (urlMedia) => {
      postPhoto(urlMedia, posts[0]);
    });
  });
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

const postPhoto = (urlImage, redditPost) => {

  var b64content = fs.readFileSync(urlImage, { encoding: 'base64' });

  Twitter.post('media/upload', { media_data: b64content }, function (err, data, response) {
    var mediaIdStr = data.media_id_string
    var meta_params = { media_id: mediaIdStr}

    Twitter.post('media/metadata/create', meta_params, function (err, data, response) {
      if (!err) {
        var params = { status: '', media_ids: [mediaIdStr] }
        postTweet(params, redditPost);
      }
    })
  });
}

getUpvotedPosts();


//getUpvotedPosts();

//postTweet();
