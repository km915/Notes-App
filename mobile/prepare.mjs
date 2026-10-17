// prepare.mjs — builds the Android project from scratch, then applies our changes to it.
// Run by .github/workflows/android.yml:   APP_URL=https://your-name.vercel.app node prepare.mjs
// Nothing it creates is committed (mobile/android is in .gitignore). If a patch no longer matches (for example
// after a Capacitor upgrade) it stops with an error instead of silently building a wrong app.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL=process.env.APP_URL||'';
if(!/^https:\/\/[^/\s]+$/.test(APP_URL))throw new Error('APP_URL must look like https://your-name.vercel.app (https, no trailing slash)');

// ===== THE DECISIONS. Changing anything marked FOREVER later means a new app that must be installed again. =====
const APP_ID='io.github.km915.notes'; // FOREVER: Android treats a different id as a different app (and Google's Android client is tied to it)
const APP_NAME='Notes';
const BG='#0b1220';                    // app background colour (splash screen, icon background)
const config={
 appId:APP_ID,appName:APP_NAME,webDir:'www',
 server:{url:APP_URL,cleartext:false},  // FOREVER (practically): the app opens this address. The website itself can change freely.
 android:{allowMixedContent:false,webContentsDebuggingEnabled:true}, // debugging: only visible to a computer connected by USB cable with debugging switched on
 plugins:{
  LocalNotifications:{smallIcon:'ic_stat_notes',iconColor:'#88C0D0'},
  SystemBars:{style:'DARK'},            // light status-bar icons on our dark theme
  SocialLogin:{providers:{google:true,facebook:false,apple:false,twitter:false}} // keep the other providers (and the Facebook SDK) out of the app
 }
};
// Native abilities built in (the page can use only these; a new one needs a new app): the page loader itself,
// @capacitor/local-notifications (reminders), @capacitor/app (go back to the previous app after "Mark as done"),
// @capgo/capacitor-social-login (Android's Google account sheet), and vibration via the VIBRATE permission below.
const PERMISSIONS=['android.permission.VIBRATE','android.permission.USE_EXACT_ALARM']; // USE_EXACT_ALARM: reminders on the dot, no settings screen (Android 13+)

const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit',shell:process.platform=='win32'});
const here=path.dirname(new URL(import.meta.url).pathname);process.chdir(here);
const A='android/app/src/main/',R=A+'res/';
function edit(file,fn){const s=fs.readFileSync(file,'utf8'),t=fn(s);if(t===s)throw new Error('patch changed nothing in '+file+' (template changed?)');fs.writeFileSync(file,t)}
const replace=(s,a,b)=>{if(!s.includes(a))throw new Error('not found: '+a.slice(0,60));return s.replace(a,b)};

// 1. config + placeholder web folder (required by Capacitor even though the app opens the website)
fs.writeFileSync('capacitor.config.json',JSON.stringify(config,null,1));
fs.mkdirSync('www',{recursive:true});
fs.writeFileSync('www/index.html','<!doctype html><title>Notes</title><p>This app opens its website. If you see this, the web address is not reachable.');

// 2. generate the Android project
if(!fs.existsSync('android'))run('npx',['cap','add','android']);
run('npx',['cap','sync','android']);

// 3. permissions, no backups
edit(A+'AndroidManifest.xml',s=>{
 s=replace(s,'android:allowBackup="true"','android:allowBackup="false"');
 return replace(s,'<uses-permission android:name="android.permission.INTERNET" />','<uses-permission android:name="android.permission.INTERNET" />\n'+PERMISSIONS.map(p=>`    <uses-permission android:name="${p}" />`).join('\n'));
});

// 4. MainActivity: the Google sign-in sheet reports back through it (steps from the plugin's Android guide)
fs.writeFileSync(A+'java/'+APP_ID.replaceAll('.','/')+'/MainActivity.java',`package ${APP_ID};

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle handle = getBridge().getPlugin("SocialLogin");
      if (handle == null) { Log.i("NotesLogin", "SocialLogin plugin handle is null"); return; }
      Plugin plugin = handle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) { Log.i("NotesLogin", "SocialLogin plugin has the wrong type"); return; }
      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }

  // Marker the plugin looks for. Never called.
  public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
`);

// 5. look: launch screen colour, icon background, status-bar reminder icon
edit(R+'values/styles.xml',s=>replace(s,'<item name="android:background">@drawable/splash</item>','<item name="android:background">@drawable/splash</item>\n        <item name="windowSplashScreenBackground">'+BG+'</item>'));
edit(R+'values/ic_launcher_background.xml',s=>s.replace(/#[0-9A-Fa-f]{6}/,BG));
fs.writeFileSync(R+'drawable/ic_stat_notes.xml',`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M6,2h12a2,2 0 0 1 2,2v16a2,2 0 0 1 -2,2H6a2,2 0 0 1 -2,-2V4a2,2 0 0 1 2,-2zM8,7v2h8V7zM8,11v2h8v-2zM8,15v2h5v-2z"/>
</vector>
`);
// icons and launch images are made from ../icon.png with ImageMagick ("convert"; the workflow installs it)
const ICON='../icon.png',magick=fs.existsSync('/usr/bin/magick')?'magick':'convert';
const px=f=>execFileSync('identify',['-format','%wx%h',f]).toString().split('x').map(Number);
for(const d of fs.readdirSync(R).filter(d=>d.startsWith('mipmap-')&&d!='mipmap-anydpi-v26')){
 const [w]=px(R+d+'/ic_launcher.png'),fg=Math.round(w*108/48);
 for(const n of ['ic_launcher.png','ic_launcher_round.png'])run(magick,[ICON,'-resize',w+'x'+w,R+d+'/'+n]);
 // adaptive icon: the picture sits in the middle 60% so no launcher shape can cut it
 run(magick,[ICON,'-resize',Math.round(fg*.6)+'x'+Math.round(fg*.6),'-background','none','-gravity','center','-extent',fg+'x'+fg,R+d+'/ic_launcher_foreground.png']);
}
for(const d of fs.readdirSync(R).filter(d=>d.startsWith('drawable')&&fs.existsSync(R+d+'/splash.png'))){
 const f=R+d+'/splash.png',[w,h]=px(f),s=Math.round(Math.min(w,h)*.25);
 run(magick,['-size',w+'x'+h,'xc:'+BG,'(',ICON,'-resize',s+'x'+s,')','-gravity','center','-composite',f]);
}

// 6. signing + version (secrets come from GitHub, see android.yml). versionCode must grow with every build.
edit('android/app/build.gradle',s=>{
 s=replace(s,'versionCode 1','versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")');
 s=replace(s,'versionName "1.0"','versionName System.getenv("VERSION_NAME") ?: "1.0"');
 s=replace(s,'    buildTypes {',`    signingConfigs {
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }
    buildTypes {`);
 return replace(s,'            minifyEnabled false','            signingConfig signingConfigs.release\n            minifyEnabled false');
});
console.log('\nAndroid project ready in mobile/android. Build: cd android && ./gradlew assembleRelease');
