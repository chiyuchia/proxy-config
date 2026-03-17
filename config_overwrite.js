function main(config) {
  const originalProxyGroups = config?.['proxy-groups'] || [];
  config['proxy-groups'] = originalProxyGroups.map((group) => {
    if (!group.filter && !group.name.includes('全球直连')) {
      console.log('🚀 ~ main ~ group.filter:', group.name);
      group.proxies = (group?.proxies ?? []).concat(config.proxies.map((proxy) => proxy.name));
      console.log('🚀 ~ main ~ group.proxies:', group.proxies);
    }
    return group;
  });
  return config;
}
