const express = require('express');
const {Readable} = require('stream');
const moment = require('moment')
const axios = require('axios');

const app = express();

app.use(logErrors);
app.use(errorHandler)

app.get('/', (req, res) => {
  res.send('Successful response');
});

app.get('/data', (req, res, next) => {

  const {begin, end} = req.query;

  try {

    if( begin && end ) {

      // Check if begin and end date are valid datetime format
      if(!moment(begin).isValid() || !moment(end).isValid()) {
        throw "Invalid date format";
      }
    
      axios({
        method: 'GET',
        url: `https://tsserv.tinkermode.dev/data?begin=${begin}&end=${moment(end).add(2, 'hours').toISOString()}`,
        responseType: 'stream'
      })
      .then(response=>{        
          let readStream = response.data
          let data='';
          readStream
          .on('data', (chunk) => {
              data += chunk.toString();
          })
          .on('error', (err_msg) => {
            console.log(err_msg);
            res.end(err_msg);
          })
          .on('end', () => {
            let dataArray = data.split(/\r?\n/);
            //Remove empty array item
            dataArray = dataArray.filter(Boolean);
            let result = [];
            let hour = moment(dataArray[0].split(/\s+/)[0]).hour();
            let hourBucketSum = 0;
            let hourBucketNum = 0;
            let timeStr = '';
            for (let i = 0; i < dataArray.length; i++) {
              let [timeData, valueData] = dataArray[i].split(/\s+/);
              
              if(moment(timeData).hour() != hour) {
                let avg = roundToFour(hourBucketSum/hourBucketNum)
                result.push(timeStr+' '+avg+'\n');
                hour = moment(timeData).hour();
                hourBucketSum=0;hourBucketNum=0;
              }
              timeStr = moment(timeData).set({minute:0, second:0}).toISOString()
              hourBucketSum += parseFloat(valueData)
              hourBucketNum +=1;
            }

            // Create readstream
            const readStream = Readable.from(result)
            readStream.pipe(res);

          });          
      })
      .catch(error => {
        throw error.message
      })

    } else {
      throw "begin and end value are requried!"
    }
  } catch(error) {
    next(error)
  }
  
});

function isChunkWorking(chunkedString) {
  if (chunkedString.length == 0) return false;
  let dataArray = chunkedString.split(/\r?\n/);

  //Remove last item if its empty string
  if(dataArray[dataArray.length-1].length == 0) {
    dataArray.pop()
  }

  let lastStr = dataArray[dataArray.length-1];

  let [timeData, valueData] = lastStr.split(/\s+/);
  if(typeof timeData == 'undefined' || typeof valueData == 'undefined' || valueData.length == 0) {
    return false;
  }

  //Check time data is valid time format
  if(!moment(timeData).isValid()) {
    return false;
  }

  //Check value data has 4 decimal places
  if(countDecimals(parseFloat(valueData)) != 4) {
    return false;
  }

  return true
}


var countDecimals = function (value) {
  if(Math.floor(value) === value) return 0;
  return value.toString().split(".")[1].length || 0; 
}

function logErrors (err, req, res, next) {
  console.error(err.stack)
  next(err)
}

function errorHandler (err, req, res, next) {
  res.status(500).send('Something broke!');
}

function roundToFour(num) {
  return +(Math.round(num + "e+4")  + "e-4");
}

app.listen(3000, () => console.log('App is running on port 3000.'))