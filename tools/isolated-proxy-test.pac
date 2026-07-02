function isPrivateHost(host) {
  return isPlainHostName(host) ||
    host === "localhost" ||
    shExpMatch(host, "127.*") ||
    shExpMatch(host, "10.*") ||
    shExpMatch(host, "192.168.*") ||
    shExpMatch(host, "172.16.*") ||
    shExpMatch(host, "172.17.*") ||
    shExpMatch(host, "172.18.*") ||
    shExpMatch(host, "172.19.*") ||
    shExpMatch(host, "172.2?.*") ||
    shExpMatch(host, "172.30.*") ||
    shExpMatch(host, "172.31.*");
}

function isChinaTestDomain(host) {
  var directDomains = [
    ".cn",
    ".com.cn",
    ".net.cn",
    ".org.cn",
    ".gov.cn",
    ".edu.cn",
    ".baidu.com",
    ".bilibili.com",
    ".qq.com",
    ".wechat.com",
    ".weixin.com",
    ".taobao.com",
    ".tmall.com",
    ".jd.com",
    ".163.com",
    ".126.com",
    ".sina.com.cn",
    ".weibo.com",
    ".zhihu.com",
    ".douyin.com",
    ".xiaohongshu.com",
    ".alibabacloud.com",
    ".aliyun.com",
    ".tencent.com",
    ".csdn.net"
  ];

  for (var i = 0; i < directDomains.length; i++) {
    if (dnsDomainIs(host, directDomains[i]) || host === directDomains[i].substring(1)) {
      return true;
    }
  }

  return false;
}

function FindProxyForURL(url, host) {
  if (isPrivateHost(host)) {
    return "DIRECT";
  }

  if (isChinaTestDomain(host)) {
    return "DIRECT";
  }

  return "PROXY 192.168.124.3:8080; DIRECT";
}
