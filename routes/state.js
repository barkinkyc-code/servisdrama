const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req,res) => {
  try {
    await db.ready();
    if (db.dialect === 'postgres') {
      const result = await db.raw.query("SELECT payload,updated_at FROM app_state WHERE state_key='main'");
      return res.json({success:true,state:result.rows[0]?.payload||{},updatedAt:result.rows[0]?.updated_at||null});
    }
    db.get("SELECT payload,updated_at FROM app_state WHERE state_key='main'",[],(err,row)=>{
      if(err)return res.status(500).json({error:'Database error'});
      res.json({success:true,state:row?JSON.parse(row.payload||'{}'):{},updatedAt:row?.updated_at||null});
    });
  } catch(err){res.status(500).json({error:'State read failed',details:err.message});}
});

router.put('/', auth, async (req,res) => {
  try {
    await db.ready();
    const state=req.body?.state;
    if(!state||typeof state!=='object')return res.status(400).json({error:'Geçerli state gerekli'});
    if(db.dialect==='postgres'){
      await db.raw.query(`INSERT INTO app_state(state_key,payload,updated_by,updated_at)
        VALUES('main',$1::jsonb,$2,NOW())
        ON CONFLICT(state_key) DO UPDATE SET payload=EXCLUDED.payload,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[JSON.stringify(state),req.user.id]);
    }else{
      await new Promise((resolve,reject)=>db.run("INSERT OR REPLACE INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',?,?,CURRENT_TIMESTAMP)",[JSON.stringify(state),req.user.id],err=>err?reject(err):resolve()));
    }
    res.json({success:true,updatedAt:new Date().toISOString()});
  }catch(err){res.status(500).json({error:'State save failed',details:err.message});}
});
module.exports=router;
