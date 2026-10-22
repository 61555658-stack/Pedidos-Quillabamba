import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { AppError } from "./operations-data";

const storage=new Storage({
  credentials:{
    audience:"replit",subject_token_type:"access_token",
    token_url:"http://127.0.0.1:1106/token",type:"external_account",
    credential_source:{url:"http://127.0.0.1:1106/credential",format:{type:"json",subject_token_field_name:"access_token"}},
    universe_domain:"googleapis.com",
  },
  projectId:"",
});
export function storageFile(path:string) {
  const dir=process.env.PRIVATE_OBJECT_DIR;
  if(!dir) throw new AppError(503,"El almacenamiento de archivos no está configurado.");
  const full=`${dir.replace(/\/$/,"")}/${path}`.replace(/^\//,"");
  const slash=full.indexOf("/");
  return storage.bucket(full.slice(0,slash)).file(full.slice(slash+1));
}
export async function storeImage(file:Express.Multer.File,purpose:"products"|"proofs") {
  const b=file.buffer;
  const detected=b.length>3 && b[0]===0xff&&b[1]===0xd8&&b[2]===0xff ? "image/jpeg"
    : b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
    : b.length>12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP" ? "image/webp" : null;
  if(!detected||detected!==file.mimetype)throw new AppError(400,"Sube una imagen JPEG, PNG o WEBP válida.");
  const ext=detected==="image/jpeg"?"jpg":detected==="image/png"?"png":"webp";
  const key=`${purpose}/${randomUUID()}.${ext}`;
  await storageFile(key).save(b,{resumable:false,metadata:{contentType:detected,cacheControl:purpose==="products"?"public,max-age=3600":"private,no-store"}});
  return key;
}
