function pi -d 'Run Pi with the agent stack Node runtime without changing project defaults'
    if command -q fnm; and test -x "$HOME/.local/share/fnm/node-versions/v24.18.0/installation/bin/pi"
        command fnm exec --using 24.18.0 pi $argv
    else
        command pi $argv
    end
end
