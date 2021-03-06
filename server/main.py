import cgi
import os
from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import db
from google.appengine.api import urlfetch
from django.utils import simplejson
import base64
import datetime
import re

DEFAULTIMG = "hji"
	
class BaseHandler(webapp.RequestHandler):
	def setexpires(self, numdays = 1):
		expires_date = datetime.datetime.utcnow() + datetime.timedelta(numdays)
		expires_str = expires_date.strftime("%d %b %Y %H:%M:%S GMT")
		self.response.headers.add_header("Expires", expires_str)
	
	def userstuff(self):
		self.viewdata = { };
		
		if users.get_current_user():
			self.viewdata["loginurl"] = users.create_logout_url(self.request.uri)
			self.viewdata["logintext"] = 'Logout'
			self.viewdata["isloggedin"] = True
		else:
			self.viewdata["loginurl"] = users.create_login_url(self.request.uri)
			self.viewdata["logintext"] = 'Login'
			self.viewdata["isloggedin"] = False
	
	def initialize(self, request, response):
		super(BaseHandler, self).initialize(request, response)
		self.userstuff()
		
class Screenshot(db.Model):
	image = db.BlobProperty()
	contenttype = db.StringProperty()
	details = db.StringProperty(multiline=True)
	date = db.DateTimeProperty(auto_now_add=True)
	message = db.StringProperty(multiline=True)
	orgkey = db.StringProperty()
	def imagesrc(self):
		return "/shots/%s" % (self.key()) 

class MainPage(BaseHandler):
		
	def get(self):
		if (self.viewdata["isloggedin"] == True):
			screenshots_query = Screenshot.all().filter("contenttype =", "image/png").order('-date')
			screenshots = screenshots_query.fetch(10)
			self.viewdata["screenshots"] = screenshots
		
		path = os.path.join(os.path.dirname(__file__), 'index.html')
		self.response.out.write(template.render(path, self.viewdata))
		
class ClosePreview(BaseHandler):
	def get(self):
		confirmmessage = "Thanks for the feedback"
		template_values = {
			'confirmmessage': confirmmessage
		}
		path = os.path.join(os.path.dirname(__file__), 'thanks.html')
		self.response.out.write(template.render(path, template_values))
		
class GetScreenshot(BaseHandler):
	def get(self, shotid = None):
		#self.response.out.write (self.request.get("id"))
		screenshot = None
		if shotid is not None:
			try:
				screenshot = db.get(shotid)
			except:
				screenshot = None
				
		if screenshot is not None:
			self.response.headers['Cache-Control'] = "public, max-age=2592000"
			self.response.headers['Content-Type'] = screenshot.contenttype
			self.setexpires(30)
			self.response.out.write (screenshot.image)
		else:
			self.error(404)
			
class SaveScreenshot(BaseHandler):
	def post(self):
		screenshot = Screenshot()
		imgdata = self.request.get('image')
		dataUrlPattern = re.compile('data:image/(png|jpeg);base64,(.*)$')
		matched = dataUrlPattern.match(imgdata)
		imagetype = matched.group(1)
		imgb64 = matched.group(2)
		if imgb64 is not None and len(imgb64) > 0:
  			screenshot.image = db.Blob(base64.b64decode(imgb64))
  			screenshot.contenttype = "image/" + imagetype
  			
		screenshot.message = self.request.get('message')
		screenshot.details = self.request.get('details')
		screenshot.put()
		self.redirect('/thanks')
	def get(self):
		details = "User agent: Firefox"
		appname = "Brian"
		message = "My Button is gone.	Not sure what happened"
		imagedata = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAPCAIAAAHHRuK2AAAACXBIWXMAAA9SAAAPUgHeurdaAAAABGdBTUEAALGOfPtRkwAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAACvElEQVR42mL+////s2fPAAKIwdknLG3XO4AAYkhNTQUKAAQQQ8qOl87eEQABxJiQkHBKzp/h33+zJ5sAAoglKCjo/PEPjIz/g4ODAQKIAaiIl5cXSAIEEKORaw+LjdqfQzcBAohFONzOUN/ggowiQAAxG7G9f23szrWsFCCAQOrs7e1PnLr69Nm7E6evANlAEYAAYhRVsucMzVaQkeXn4fr07dedxy9+rZwIEEDM2SlhX5VdPG2NdHXEZaWk3n7/7yv+AiCAGIHqDxw4cOrUqadPn0pJSVlYWAANAQggZqCohITEx48fZWVlq6qqtmzZAhBAzH/+/GHjEqqrrw8Jibp048aWjesBAojR0NPnh1Qwt7wQAwPD14fvOB5tAggglv9CgYxKcuISIgwMjPdZeBl+ewEEEMs3aRE9NWU5KXEmJiZOfr5LHz4DBBCTyL3NUqLCslIcspJs0lKSgrf2AQQQi5eBwtr+givheUCzPqyaEmQiDxBAIKctWrTo2rVrf//+1dHRiY+PBwggkBBQvqSk5Ny5c97e3np6ekJCwu/evb106dLWrVuNjIx6enqACgACiFlOTi4lM5WBU0lDy0dUSe8Li8Dzr0wf/nAzsEqysys/ePSuq7eUlYkVIIAY7b0cPn11eiUt9FtUjJ+PnY+bG6ibgZHx87cfHz99Z3z5SfLxMz6u/QABACgA1/8E4+AaDUcoGRoTDg8UEw8JCwwKBQAA/QAB9fX56/D08Bvy+xcR47nWAgAoANf/BDg0AMH49DkcJBESGhASEgwIAggFAPr9APb4ABDt8evt6sXb50MyAwKIyd3Z3f7TnjObNj748JuRjYGfj0GAH4QY2P49+Pr3/JaVzp83eLi5AgQQyL/r16+/devW5cuXf/z48f37958/f7Kzs3NwcHBycurq6qqpqQUGBgIEGAC17QYJnEnGIAAAAABJRU5ErkJggg=="
		
		template_values = {
			"image": imagedata,
			"app": appname,
			"details": details,
			"message": message,
			"imagesrc": imagedata
		}
		
		path = os.path.join(os.path.dirname(__file__), 'preview.html')
		self.response.out.write(template.render(path, template_values))
		
class Proxy(BaseHandler):
	def get(self):
		url = self.request.get('url')
		if url == "":
			url = "http://www.google.com/images/logos/ps_logo2.png"
		result = urlfetch.fetch(url)
		
		if result.status_code == 200:
			contenttype = result.headers['content-type']
			self.response.out.write("data:%s;base64,%s" % 
				(contenttype, base64.b64encode(result.content)))
	
application = webapp.WSGIApplication(
									 [('/', MainPage),
									  ('/send/*', SaveScreenshot),
									  ('/saved/*', SaveScreenshot),
									  ('/thanks/*', ClosePreview),
									  ('/preview/*', SaveScreenshot),
									  ('/shots', GetScreenshot),
									  (r'/shots/(.*)', GetScreenshot),
									  ('/proxy/*', Proxy)],
									 debug=True)


def main():
	run_wsgi_app(application)

if __name__ == "__main__":
	main()