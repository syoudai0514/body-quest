const KEY='body-quest-access';

export function getAccess():string {
 try {const saved=localStorage.getItem(KEY);if(saved)return saved;} catch { /* Storage can be unavailable in a restricted browser. */ }
 let previous='';
 try {previous=sessionStorage.getItem(KEY)??'';} catch {return '';}
 if(previous)try {localStorage.setItem(KEY,previous);sessionStorage.removeItem(KEY);} catch { /* Keep the existing session usable if migration fails. */ }
 return previous;
}

export function saveAccess(password:string):void {
 // Do not claim persistence when the device refused the write.
 if(password)localStorage.setItem(KEY,password);else localStorage.removeItem(KEY);
 try {sessionStorage.removeItem(KEY);} catch { /* Persistent storage already succeeded. */ }
}
