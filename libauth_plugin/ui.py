import threading
import asyncio
import datetime
from PyQt5.QtGui import *
from PyQt5.QtCore import *
from PyQt5.QtWidgets import *

from electroncash.i18n import _
from electroncash_gui.qt.util import MyTreeWidget, MessageBoxMixin, WindowModalDialog, Buttons, CancelButton,OkButton
from electroncash import util 
from electroncash.util import print_error

import sys
import time
import os 
class Ui(MyTreeWidget, MessageBoxMixin):


    def __init__(self, parent, plugin, wallet_name):
        # An initial widget is required.
        MyTreeWidget.__init__(self, parent, self.create_menu, [], 0, [])

        import os.path
        self.plugin = plugin
        self.wallet_name = wallet_name 

 
    # Functions for the plugin architecture.
    def create_menu(self):
        pass

    def on_delete(self):
        pass

    def on_update(self):
        pass
        
        
  
        
        
        
        
        
                            
