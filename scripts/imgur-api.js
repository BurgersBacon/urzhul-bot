const https = require('https');

class imgurMethods {
  constructor(imgur_credentials) {
    this.url = "api.imgur.com";
    this.path = "/3"
    this.clientId = imgur_credentials.clientID;
    this.clientIdSecret = imgur_credentials.clientIDSecret;
    this.getRequest = (method, callback, idImage) => {
      var options = {
         headers: {
             'Authorization': `Client-ID ${this.clientId}`,
         },
         host: this.url,
         path: `${this.path}/${method}/${idImage?idImage:''}`,
         method: 'GET'
      };

      console.log(`sending request to ${options.path}`);

      var request = https.get(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', function (data) {
            console.log("image found in imgur, posting...");
            callback(data);
        });
      });
      request.on('error', function(err) {
          console.log(err);
          return(err);
      });
    };
  }

  getImage(idImage, callback) {
    console.log(`getting image ${idImage}`);
    this.getRequest("image", callback, idImage);
  }
}

module.exports = imgurMethods;
