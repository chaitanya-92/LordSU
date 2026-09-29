const apiOrigin=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000";

export default {
  poweredByHeader:false,
  reactStrictMode:true,
  async headers(){
    return [{
      source:"/(.*)",
      headers:[
        {key:"X-Content-Type-Options",value:"nosniff"},
        {key:"X-Frame-Options",value:"DENY"},
        {key:"Referrer-Policy",value:"no-referrer"},
        {key:"Permissions-Policy",value:"camera=(),microphone=(),geolocation=()"},
        {key:"Content-Security-Policy",value:`default-src 'self'; connect-src 'self' ${apiOrigin}; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`},
        ...(process.env.NODE_ENV==="production"?[{key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"}]:[])
      ]
    }];
  }
};
