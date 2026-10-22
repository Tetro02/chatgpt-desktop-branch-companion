'use strict';
const {version}=require('./package.json');

// Entries run in order; dependent features follow the features they use.
module.exports={
  name:'GPT助手',
  version,
  modules:[
    {id:'branches',name:'分支',file:'companion.js',global:'__branchCompanion'},
    {id:'bookmarks',name:'书签',file:'bookmarks.js',global:'__bookmarkCompanion',dependsOn:['branches']}
  ]
};
