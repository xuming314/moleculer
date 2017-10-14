
const Message = require("./message");

let msg = new Message();

msg.addFrame(1, Buffer.from("First"));
msg.addFrame(2, Buffer.from("Second"));
msg.addFrame(3, "Third");

let buf = msg.toBuffer();
console.log(buf);
console.log(buf.toString());
//console.log(buf.toJSON());
console.log(buf.length);

let msg2 = Message.fromBuffer(buf);
console.log(msg2.frames);
console.log("1.", msg2.frames[0][2].toString());
console.log("2.", msg2.frames[1][2].toString());
console.log("3.", msg2.frames[2][2].toString());
