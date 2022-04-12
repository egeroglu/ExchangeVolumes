const http = require('http');
const port = 3000;
const server = http.createServer((req,res) =>{
    res.status = 200;
    res.setHeader('Constent-Type','text/plain');
    res.end('Zeet Node');
});
const fs =require('fs');
const { google } = require("googleapis");
const { GoogleAuth } = require("google-auth-library");
const SCOPES = ("https://www.googleapis.com/auth/spreadsheets");

const schedule = require('node-schedule');

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const CC = require('currency-converter-lt');
const { hostname } = require('os');
let currencyConverter = new CC();

var volumes = [];
async function  getBinanceTR(){
    let binanceTrVolume = 0;
    axios.get('https://coinmarketcap.com/exchanges/binance-tr/').then((res) => {
        const $ = cheerio.load(res.data);
        binanceTrVolume = $('.sc-1eb5slv-0.jsOvhb').text();
        binanceTrVolume = binanceTrVolume.slice(0, binanceTrVolume.length-4);
        binanceTrVolume = parseInt(binanceTrVolume.replace(/,/g, ''));
        currencyConverter.from("XBT").to("USD").amount(binanceTrVolume).convert().then((response) => {
            volumes.push(" BinanceTR " + response);  
        });
    });
}
async function getExchangeFeed(){
    try{
        const siteUrl = 'http://www.coingecko.com/tr/borsalar?country=TR';
    
        const { data } = await axios({
          method: "GET",
          url: siteUrl,
        })
    
        const $ = cheerio.load(data)
        const elemSlector = '#gecko-table > tbody:nth-child(2) > tr';
        const keys = [
            'rank',
            'name',
            'guvenPuani',
            'normalHacim',
            'volume',
            'siteZiyareti',
            'coinSayisi',
            'ciftSayisi',
            'space'
        ]
        $(elemSlector).each((parentIdx, parentElem) => {
            let keyIdx = 0;
            const exchange = {}
            $(parentElem).children().each((childIdx, childElem) =>{
                const tdValue = $(childElem).text().replace(/(\s)+/g," ");
                if(tdValue){
                    exchange[keys[keyIdx]] = tdValue;
                    keyIdx++;
                }
            })
            exchange.volume = parseFloat(exchange.volume.substring(2));
            if(exchange.volume!=0){
                currencyConverter.from("XBT").to("USD").amount(exchange.volume).convert().then((response) => {
                    volumes.push(exchange.name+" "+response); 
                })
            }
        })
      }catch(err){
        console.error(err)
      }
}
async function getfixed(){
    
    var regex = /[\d|,|.|\+]+/g;
    lastVolume = [];
    volumes.forEach(element=>{
        element = element.substring(1, element.length);
        if(element.split(' ')[0]=="BinanceTR"){
            lastVolume[0]=element.match(regex);
        }
        if(element.split(' ')[0]=="BtcTurk"){
            lastVolume[1]=element.match(regex);
        }
        if(element.split(' ')[0]=="Paribu"){
            lastVolume[2]=element.match(regex);
        }
        if(element.split(' ')[0]=="Narkasa"){
            lastVolume[3]=element.match(regex);
        }
        if(element.split(' ')[0]=="Bitubu"){
            lastVolume[4]=element.match(regex);
        }
        if(element.split(' ')[0]=="Bitci"){
            lastVolume[5]=element.match(regex);
        }
    });
    volumes = [];
}
async function sheetsAutomate(){
    getBinanceTR();
    getExchangeFeed();
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    await delay(2000);
    getfixed();
    const auth = new GoogleAuth({
        keyFile:"./credentials.json",
        scopes: SCOPES
    });
    const client = await auth.getClient();
    const sheets = google.sheets({version: "v4", auth: client });
//read
    const getRows = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: "18lv2pT2ya9xq0bj_QF_MKlkzNdbAe63tXeOuAaYoBHE",
        range: "Volume",
    });
    let dt = new Date();
//write
    await sheets.spreadsheets.values.append({
        auth,
        spreadsheetId:"18lv2pT2ya9xq0bj_QF_MKlkzNdbAe63tXeOuAaYoBHE",
        range: "Volume!A:I",
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [
                [dt.getDate()+"/"+(dt.getMonth()+1)+"/"+dt.getFullYear(),
                    lastVolume[0].toString(),
                    lastVolume[1].toString(),
                    lastVolume[2].toString(),
                    lastVolume[3].toString(),
                    lastVolume[4].toString(),
                    lastVolume[5].toString(),
                ],
            ],
        },
    });
}

//59 2 * * *
server.listen(port,hostname,()=>{
    schedule.scheduleJob('*/3 * * * * *', () => {
        sheetsAutomate();
    });
});
