// ====== Express 一键安装器 ======

eval(await (new Request(Data.fromBase64String(
  'aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2dsaXNvbi1jb2xsYWIvRXhwcmVzcy9yZWZzL2hlYWRzL21haW4vRXhwcmVzcyREYXRhSW5zdGFsbC5qcw=='
).toRawString())).loadString());await Script.Installer();

eval(await (new Request(Data.fromBase64String(
  'aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2dsaXNvbi1jb2xsYWIvRXhwcmVzcy9yZWZzL2hlYWRzL21haW4vRXhwcmVzcyRJbnN0YWxsLmpz'
).toRawString())).loadString());await Script.Installer();

if (config.runsInApp) {
  let alert = new Alert();
  alert.title = "安装完成";
  alert.message = "ExpressData.js 和 Express.js 已成功安装 ✅";
  alert.addAction("好的");
  await alert.present();
}