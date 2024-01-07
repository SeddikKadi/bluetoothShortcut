/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from "gi://GObject";
import St from "gi://St";
import Gio from "gi://Gio";
import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _("My Shiny Indicator"));

      this.pairedDevices = null;
      this.box = new St.BoxLayout();
      this.state = false;
      this.btLabel = "test";
      // bluetooth switch
      // this.icon = new St.Icon({
      //     icon_name: 'bluetooth-active',
      //     style_class: 'system-status-icon',
      // });
      this.bluetoothSwitch = new PopupMenu.PopupSwitchMenuItem(
        this.btLabel,
        this.state,
        {}
      );
      this.bluetoothSwitch.connect("toggled", this._onSwitchToggled.bind(this));
      log("test:" + this.bluetoothSwitch.state);

      // this.item = new PopupMenu.PopupMenuItem(_('Show Notification'));
      // this.item.connect('activate', () => {
      //     Main.notify(_('Whatʼs up, folks?'));
      // });
      // this.box.add_child(this.icon);
      this.box.add_child(this.bluetoothSwitch);
      this.add_child(this.box);
    }
    async bluetoothInit() {
      try {
        this.pairedDevices = await this.getPairedBluetoothDevices();
      } catch (err) {
        log(err);
      }
      if (this.pairedDevices) {
        try {
          this.state = await this.isDeviceConnected(this.pairedDevices);
        } catch (err) {
          log(err);
        }
        this.bluetoothSwitch.setToggleState(this.state);
      }
    }

    extractMacAddress(output) {
      const regex = /\(([\dA-Fa-f:]+)\)/;
      const match = output.match(regex);
      return match ? match[1] : null;
    }

    async _onSwitchToggled() {
      if (this.bluetoothSwitch.state) {
        // Code to show notification when the switch is turned on
        let device = null;
        try {
          device = await this.getPairedBluetoothDevices();
        } catch (err) {
          log(err);
        }
        if (device) {
          this.state = await this.isDeviceConnected(device);
          log("before toggle:" + this.state);
        }
        try {
          await this.toggleDeviceConnection(device, this.state);
        } catch (err) {
          log(err);
        }
        this.state = await this.isDeviceConnected(this.pairedDevices);
        log("after toggle:" + this.state);
        this.bluetoothSwitch.setToggleState(!this.state);

        Main.notify(_("Switch is ON"), _("The switch has been turned on."));
      } else {
        // Code to show notification when the switch is turned off
        Main.notify(_("Switch is OFF"), _("The switch has been turned off."));
      }
    }

    async isDeviceConnected(macAddress) {
      const subprocess = new Gio.Subprocess({
        argv: ["bluetoothctl", "info", macAddress],
        flags: Gio.SubprocessFlags.STDOUT_PIPE,
      });
      subprocess.init(null);

      return new Promise((resolve, reject) => {
        subprocess.wait_async(null, (source, result) => {
          try {
            const [ok, stdout, stderr] = subprocess.communicate_utf8(
              null,
              null
            );
            if (ok) {
              const output = stdout.toString();
              const isConnected = output.includes("Connected: yes");
              resolve(isConnected);
            } else {
              reject(new Error("Failed to get device info"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    async toggleDeviceConnection(macAddress, connect) {
      const command = connect ? "connect" : "disconnect";
      const subprocess = new Gio.Subprocess({
        argv: ["bluetoothctl", command, macAddress],
        flags: Gio.SubprocessFlags.STDOUT_PIPE,
      });
      subprocess.init(null);

      return new Promise((resolve, reject) => {
        subprocess.wait_async(null, (source, result) => {
          try {
            const [ok, stdout, stderr] = subprocess.communicate_utf8(
              null,
              null
            );
            resolve(ok);
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    async getPairedBluetoothDevices() {
      const subprocess = new Gio.Subprocess({
        argv: ["bt-device", "-l"],
        flags: Gio.SubprocessFlags.STDOUT_PIPE,
      });
      subprocess.init(null);

      return new Promise((resolve, reject) => {
        subprocess.wait_async(null, (source, result) => {
          try {
            const [ok, stdout, stderr] = subprocess.communicate_utf8(
              null,
              null
            );
            if (ok) {
              const output = this.extractMacAddress(stdout.toString());

              // Process the output to extract device information
              // Example output: "Device XX:XX:XX:XX:XX:XX DeviceName"
              resolve(output); // Or further process the output to a more usable format
            } else {
              reject(new Error("Failed to get paired devices"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
    }
  }
);

export default class IndicatorExampleExtension extends Extension {
  async enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    await this._indicator.bluetoothInit();
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}
