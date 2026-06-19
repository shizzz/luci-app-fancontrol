include $(TOPDIR)/rules.mk

PKG_NAME:=fancontrol
PKG_VERSION:=0.0.1
PKG_RELEASE:=1

PKG_MAINTAINER:=LuCI FanControl Contributors
PKG_LICENSE:=GPL-2.0-or-later

FANCONTROL_UPSTREAM_VERSION:=0.0.2
FANCONTROL_UPSTREAM_REPO:=shizzz/openwrt-fancontrol

PKGARCH:=$(ARCH)

include $(INCLUDE_DIR)/package.mk

FANCONTROL_ASSET_ARCH:=$(shell $(CURDIR)/../scripts/select-fancontrol-arch.sh $(ARCH) v$(FANCONTROL_UPSTREAM_VERSION))
FANCONTROL_ASSET:=openwrt-fancontrol-linux-$(FANCONTROL_ASSET_ARCH).tar.gz
FANCONTROL_URL:=https://github.com/$(FANCONTROL_UPSTREAM_REPO)/releases/download/v$(FANCONTROL_UPSTREAM_VERSION)/$(FANCONTROL_ASSET)

define Download/fancontrol
  FILE:=$(FANCONTROL_ASSET)
  URL:=$(FANCONTROL_URL)
endef
$(eval $(call Download,fancontrol))

define Package/fancontrol
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=OpenWrt FanControl daemon
  URL:=https://github.com/shizzz/openwrt-fancontrol
endef

define Package/fancontrol/description
  Userspace fan controller reading UCI configuration and adjusting PWM outputs
  based on thermal sensor readings. Supports PID and fixed PWM modes.
endef

define Build/Prepare
	$(INSTALL_DIR) $(PKG_BUILD_DIR)
	tar -xzf $(DL_DIR)/$(FANCONTROL_ASSET) -C $(PKG_BUILD_DIR)
	$(FIND) $(PKG_BUILD_DIR) -name openwrt-fancontrol -type f -exec $(CP) {} $(PKG_BUILD_DIR)/openwrt-fancontrol \;
endef

define Build/Compile
endef

define Package/fancontrol/conffiles
/etc/config/fancontrol
endef

define Package/fancontrol/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/openwrt-fancontrol $(1)/usr/sbin/openwrt-fancontrol
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/fancontrol.init $(1)/etc/init.d/fancontrol
	$(INSTALL_DIR) $(1)/etc/config
endef

$(eval $(call BuildPackage,fancontrol))
