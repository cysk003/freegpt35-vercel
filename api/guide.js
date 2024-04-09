export default async function handler(request, response) {
    const host = request.headers.host;
    console.log("host", host);
    const htmlContent = `<h3>在沉浸式翻译中使用接口地址：https://${host}/v1/chat/completions<br/>APIKEY、模型随意填，每秒最大请求数设置为30</h3>
    <h3>我这个链接给大伙参考nextweb等应用内试一下用的，别刷哈，有并发和用量限制，而且定期更换域名，超30并发就寄，寄了我以后就不放demo链接了</h3>
    `;
    response.setHeader('Content-Type', 'text/html');
    response.send(htmlContent);
}
