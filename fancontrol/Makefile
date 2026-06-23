include $(TOPDIR)/rules.mk

FANCONTROL_UPSTREAM_REPO:=shizzz/openwrt-fancontrol

PKG_NAME:=fancontrol
PKG_RELEASE:=1

PKG_MAINTAINER:=LuCI FanControl Contributors
PKG_LICENSE:=GPL-2.0-or-later

ifdef ARCH
FANCONTROL_RELEASE_MK:=$(shell sh $(CURDIR)/scripts/resolve-fancontrol-release.sh $(ARCH) $(FANCONTROL_UPSTREAM_REPO) $(DL_DIR))
ifeq ($(FANCONTROL_RELEASE_MK),)
  $(error Unable to resolve latest fancontrol release for ARCH=$(ARCH))
endif
include $(FANCONTROL_RELEASE_MK)
PKG_VERSION:=$(FANCONTROL_VERSION)
PKGARCH:=$(ARCH)
else
PKG_VERSION:=0.0.0
endif

include $(INCLUDE_DIR)/package.mk

ifdef ARCH
define Download/fancontrol
  FILE:=$(FANCONTROL_ASSET)
  URL:=$(FANCONTROL_URL)
  HASH:=$(FANCONTROL_HASH)
endef
$(eval $(call Download,fancontrol))
endif

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
	$(CP) $(PKG_BUILD_DIR)/openwrt-fancontrol-linux-$(FANCONTROL_ASSET_ARCH) $(PKG_BUILD_DIR)/openwrt-fancontrol
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
