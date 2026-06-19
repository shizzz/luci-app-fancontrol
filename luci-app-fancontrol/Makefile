include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI FanControl
LUCI_DESCRIPTION:=Web interface for configuring and monitoring openwrt-fancontrol
LUCI_DEPENDS:=+luci-base +fancontrol
LUCI_PKGARCH:=all

PKG_VERSION:=0.0.1
PKG_RELEASE:=1

PKG_MAINTAINER:=LuCI FanControl Contributors
PKG_LICENSE:=GPL-2.0-or-later

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
