#!/bin/sh
# @configure_input@
include $(top_srcdir)/xpt.mk
JS_FILES=eveapiservice.js eveitem.js dbwrapper.js
XPT_FILES=eveapiservice.xpt nsIEveItem.xpt nsIEveDBWrapper.xpt

JS_FILES+=eveskill.js
XPT_FILES+=nsIEveSkill.xpt
comp_DATA=$(JS_FILES) $(XPT_FILES)
pref_DATA=api_pref.js
