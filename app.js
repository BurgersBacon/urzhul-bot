const config = require('./config');
const twit = require('twit');
const Twitter = new twit(config);

let params = {

}

function postTweet() {
  Twitter.post('statuses/update', {status: 'i did not decided to live, but here i am... i mean, bip bop bop bip'}, function(err, data, response) {
    console.log(data);
  })
}

postTweet();
