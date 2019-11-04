const config = require('./config');
const Twit = require('twit');
const Twitter = new Twit(config);

let params = {

}

function postTweet() {
  console.log("executing")
  Twitter.post('statuses/update', {status: 'i did not decided to live, but here i am... i mean, bip bop bop bip'}, function(err, data, response) {
    console.log(data);
    console.log("data");
  })
}

postTweet();
