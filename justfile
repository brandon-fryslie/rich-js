set dotenv-load

build:
    npm run build

test *args:
    npm run test -- {{ args }}

lint:
    npm run lint

clean:
    npm run clean

# Demos
demo:
    npm run demo

demo-inputs:
    npm run demo-inputs

dash:
    npm run dash

colors:
    npm run colors

sessions:
    npm run sessions

strip:
    npm run strip

markup-plugins:
    npm run markup-plugins

themes-transposed:
    npm run themes:transposed

themes-transposed-html out="/tmp/transpose-demo.html":
    EXPORT_HTML={{ out }} npm run themes:transposed
