import Head from 'next/head'
import Layout from '../../../../../components/layout';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router'
import { Form, Button, ListGroup, Image, Container, Row, Col } from 'react-bootstrap';
import ReactPlayer from 'react-player'
import Styles from '../../../../../styles/video.module.css';
import fetch from 'node-fetch'
import vtt from 'vtt-live-edit';
import Router from 'next/router';

import cookies from 'next-cookies'

// Fetcher for useSWR, redirect to login if not authorized
let fetchedMetadata = false;
let selectedImages = [];


export default function Home(props) {
  const server = props.server;
  const availableSubtitles = props.subtitles;
  const router = useRouter();
  const { id } = router.query;
  const serverToken = props.serverToken;
  const [metadata, setMetadata] = useState({});
  const [watched, setWatched] = useState(false);
  const [startWatching, setStartWatchin] = useState(false);

  // Used for manual metadata search
  const [metadataBox, setMetadataBox] = useState(false);
  const [metadataSearchResult, setMetadataSearchResult] = useState([]);
  const metadataSearch = useRef(null);

  // Used for choosing the poster/backdrop picture
  const [imageBox, setImageBox] = useState(false);
  const [movieBackdropResult, setMovieBackdropResult] = useState([]);
  const [moviePosterResult, setMoviePosterResult] = useState([]);

  // Ugly hack to be able to access the videojs element outside of useEffect(). 
  // The videojs object will be inserted here.
  const [videoObj, setVideoObj] = useState(null);

  let video = undefined;
  let videoSources = [];



  // This has it's own useEffect because if it doesn't videojs doesn't work (????)
  useEffect(() => {
    fetch(`http://${server.server_ip}:4000/api/movies/${id}?token=${serverToken}`, {
      method: 'GET',
      headers: {
          'Content-Type': 'application/json'
      }
    })
    .then(r => r.json())
    .then(result => {
      let meta = result.result;
      let finish_at = new Date(new Date().getTime() + meta.runtime * 60000);
      meta.finish_at = finish_at.getHours() + ":" + finish_at.getMinutes();
      for (let image of meta.images) {
        if (image.active && image.type === 'BACKDROP') {
          meta.backdrop = image.path;
        }
        if (image.active && image.type === 'POSTER') {
          meta.poster = image.path;
        }
      }

      let currentTime = "";
      let hours = Math.floor(meta.currentTime / 60 / 60)
      let minutes = Math.floor(meta.currentTime / 60)
      let seconds = Math.floor(meta.currentTime % 60);
      if (hours >= 1) {
        currentTime += `${hours}:`
      }
      if (minutes < 10) {
        minutes = `0${minutes}`;
      }
      if (seconds < 10) {
        seconds = `0${seconds}`
      }
      currentTime += `${minutes}:${seconds}`
      meta.currentTimeSeconds = meta.currentTime;
      meta.currentTime = currentTime;
      setWatched(meta.watched);
      setMetadata(meta);
      return () => {
        video = video;
        
      }
    });
  }, []);



  const loadSources = () => {
    // Get the saved time for this video
    fetch(`http://${server.server_ip}:4000/api/video/${id}/currenttime/get?type=movie&token=${serverToken}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(r => r.json())
    .then(time => {
      time = time.time;
        // Get the available resolutions for this video
        fetch(`http://${server.server_ip}:4000/api/video/${id}/getResolution`, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json'
          }
        })
        .then(r => r.json())
        .then(result => {
          let sources = [];
          if (result.directplay) {
            sources.push({
              src: `http://${server.server_ip}:4000/api/video/${id}?token=${serverToken}&start=${time}&quality=directplay`,
              type: 'video/mp4',
              label: 'directplay',
              selected: true
            });
          }

          let count = 0;
          for (let resolution of result.resolutions) {
            sources.push({
              src: `http://${server.server_ip}:4000/api/video/${id}?token=${serverToken}&start=${time}&quality=${resolution}`,
              type: 'video/mp4',
              label: resolution,
              selected: !result.directplay && count === 0
            });
            count++;
          }
          videoSources = sources;
          video.src(videoSources);
          video.currentTime(time);
        });
    });
  }


  const loadSubtitles = () => {
    // Load all the subtitles
    for (let subtitle of availableSubtitles) {
      console.log("LOADING SUBTITLE");
      video.addRemoteTextTrack({
        kind: 'subtitles',
        label: subtitle.language,
        language: subtitle.language,
        src: `http://${server.server_ip}:4000/api/subtitles/get?id=${subtitle.id}`
      }, false);
    }
  }


  useEffect(() => {
      video = videojs("video");
      console.log("MOUNTING PLUGIN")
      require('@silvermine/videojs-quality-selector')(videojs);
      video.controlBar.addChild('QualitySelector');
      loadSources();
      loadSubtitles();

    // Initiate video.js
    // Get metadata for this movie (only if we haven't fetched it before)

     // hack duration
     video.duration= function() {return video.theDuration; };
     video.start= 0;

     // The original code for "currentTime"
     video.oldCurrentTime = function currentTime(seconds) {
      if (typeof seconds !== 'undefined') {
        if (seconds < 0) {
          seconds = 0;
        }
        this.techCall_('setCurrentTime', seconds);
        return;
      }
      this.cache_.currentTime = this.techGet_('currentTime') || 0;
      return this.cache_.currentTime;
    }

      // Our modified currentTime
     video.currentTime= function(time) 
     { 
         if( time == undefined )
         {
             return video.oldCurrentTime() + video.start;
         }

         /* THE CODE BELOW WILL RUN WHEN THE USER SEEKS THE VIDEO */

         // Save the current source (So we know what quality to play after seek)
         let currentQuality = video.currentSource().label;
         let paused = video.paused();
         // Find the current active subtitle and save it so we know what to show after seek.
         let tracks = video.textTracks();
         let activeSub;
         for (let i = 0; i < tracks.length; i++) {
           if (tracks[i].mode == 'showing') {
             activeSub = tracks[i].label;
           }
         }

         // Hack video.js start time (So we can see the videos playing time / current time)
         video.start= time;
         video.oldCurrentTime(0);
         // Set the new source (with the offset)

         for (let i = 0; i < videoSources.length; i++) {
           videoSources[i].src = `http://${server.server_ip}:4000/api/video/${id}?start=${time}&token=${serverToken}&quality=${videoSources[i].label}`
           if (currentQuality !== videoSources[i].label) {
              videoSources[i].selected = false;
           } else {
              videoSources[i].selected = true;
           }
         }
         
         video.src(videoSources);


          // Add the subtitles again, and set "activeSub" to active.
          for (let subtitle of availableSubtitles) {
            if (subtitle.language === activeSub) {
              video.addRemoteTextTrack({
                kind: 'subtitles',
                label: subtitle.language,
                language: subtitle.language,
                src: `http://${server.server_ip}:4000/api/subtitles/get?id=${subtitle.id}&start=${time}`,
                default: true
              }, false);
            } else {
              video.addRemoteTextTrack({
                kind: 'subtitles',
                label: subtitle.language,
                language: subtitle.language,
                src: `http://${server.server_ip}:4000/api/subtitles/get?id=${subtitle.id}&start=${time}`
              }, false);
            }
            try {
              //video.play();
            } catch (e) {
              console.log("Play canceled, probably a new seek.");
            }
          }
          if (!paused) {
            video.play();
          }

         return this;
     };

       // Get the dureation of the movie
       if (id !== undefined) {
        $.getJSON( `http://${server.server_ip}:4000/api/video/${id}/getDuration`, function( data ) 
        {
            video.theDuration= data.duration;
        });
       }

       setVideoObj(video);
       return () => {
        video = video;
        
      }
  }, []);

  useEffect(() => {
    if (startWatching !== false) {
      videoObj.currentTime(startWatching);
      videoObj.play();
      document.getElementById('video').style.opacity = '1';
      document.getElementById('video').style.zIndex = '10';
      document.getElementById('container').style.opacity = '0';
      setInterval(() => {
        updateWatchTime(videoObj.currentTime());
      }, 5000);
    }
    return () => {
        video = video;
    }

});

    const updateWatchTime = (time) => {
        fetch(`http://${server.server_ip}:4000/api/video/${id}/currenttime/set?type=movie&time=${time}&videoDuration=${videoObj.theDuration}&token=${serverToken}`);
    }

    const markAsWatched = () => {
      fetch(`http://${server.server_ip}:4000/api/movies/${id}/setWatched?watched=true&token=${serverToken}`)
      .then(r => r.json())
      .then(status => {
        if (status.success) {
          setWatched(true);
        } else {
          console.log("ERROR MARKING AS WATCHED: " + status);
        }
      })      .catch(err => {
        console.log(err);
      });
    }

    const markAsNotWatched = () => {
      fetch(`http://${server.server_ip}:4000/api/movies/${id}/setWatched?watched=false&token=${serverToken}`)
      .then(r => r.json())
      .then(status => {
        if (status.success) {
          setWatched(false);
        } else {
          console.log("ERROR MARKING AS WATCHED: " + status);
        }
      })
      .catch(err => {
        console.log(err);
      });
    }

    const searchMetadata = (event) => {
      let search = metadataSearch.current.value;
      console.log(search);
      fetch(`http://${server.server_ip}:4000/api/movies/searchMetadata?search=${search}`)
      .then(r => r.json())
      .then(result => {
        console.log(result);
        let metadataElements = [];
        for (let movie of result) {
          let img = movie.poster_path !== null ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}` : 'https://via.placeholder.com/500x750' 
          metadataElements.push(
            <ListGroup.Item key={movie.id} className={Styles.metadataSearchRow} data-metadataid={movie.id}>
              <Image src={img} />
              <div>
                <h5>{movie.title}</h5>
                <p>{movie.overview}</p>
              </div>
              <Button onClick={() => updateMetadata(movie.id)}>Välj</Button>
            </ListGroup.Item>
          );        
        }
        setMetadataSearchResult(metadataElements);
      });
      event.preventDefault();
    }

    const updateMetadata = (metadataID) => {
      fetch(`http://${server.server_ip}:4000/api/movies/${id}/updateMetadata?metadataID=${metadataID}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          Router.reload(window.location.pathname);
        }
      });
    }

    const updateImages = () => {
      let poster;
      let backdrop;
      for (let image of selectedImages) {
        if (image.type === 'POSTER') {
          poster = image.id;
        } else if (image.type === 'BACKDROP') {
          backdrop = image.id;
        }
      }
      console.log(selectedImages);
      console.log(poster);
      console.log(backdrop);

      fetch(`http://${server.server_ip}:4000/api/movies/${id}/setImages?poster=${poster}&backdrop=${backdrop}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          Router.reload(window.location.pathname);
        }
      });
    }

    const selectImage = (imageID, type) => {
      let selected = [];

      // Add the other type that we did not select to the new selected list
      for (let image of selectedImages) {
        if (image.type !== type) {
          selected.push(image);
        } else {
          // Remove the active class
          document.body.querySelector(`img[data-imageid="${image.id}"]`).classList.remove(Styles.activeImage);
        }
      }

      document.body.querySelector(`img[data-imageid="${imageID}"]`).classList.add(Styles.activeImage);

      selected.push({
        id: imageID,
        type: type
      })
      selectedImages = [];
      for (let image of selected) {
        selectedImages.push(image);
      }
    }


    const getImages = () => {
      fetch(`http://${server.server_ip}:4000/api/movies/${id}/getImages`)
      .then(r => r.json())
      .then(images => {
        let backdropElements = [];
        let posterElements = [];
        let count = 0;
        selectedImages = [];
        for (let image of images) {
          let img = `https://image.tmdb.org/t/p/w500/${image.path}`
          if (image.active) {
            selectedImages.push({
              id: image.id,
              type: image.type
            });
          }
          let active = image.active;
          if (image.type === 'BACKDROP') {
            backdropElements.push(
              <Col key={count} className={Styles.metadataSearchRow}>
                <Image style={{width: "500px"}} src={img} className={'imageSearchImg', active ? Styles.activeImage : ''} onClick={() => selectImage(image.id, image.type)} data-imageid={image.id}/>
              </Col>
            );
          } else {
            posterElements.push(
              <Col key={count} className={Styles.metadataSearchRow}>
                <Image style={{width: "200px"}} src={img} className={'imageSearchImg', active ? Styles.activeImage : ''} onClick={() => selectImage(image.id, image.type)} data-imageid={image.id}/>
              </Col>
            );
          }
          count++;
        }
        setMoviePosterResult(posterElements);
        setMovieBackdropResult(backdropElements);
        setImageBox(true);
      });
    }



    
    //  
  return (
    <>
        <Head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300&display=swap" rel="stylesheet" />
        <script src="https://vjs.zencdn.net/7.7.6/video.js"></script>

        <link href="https://unpkg.com/@silvermine/videojs-quality-selector/dist/css/quality-selector.css" rel="stylesheet" />
        <script src="http://code.jquery.com/jquery-1.9.1.min.js"></script>
        <link href="https://vjs.zencdn.net/7.7.6/video-js.css" rel="stylesheet" />
        <link href="/chromecast/silvermine-videojs-chromecast.css" rel="stylesheet" />
        <script src="https://unpkg.com/@silvermine/videojs-quality-selector/dist/js/silvermine-videojs-quality-selector.min.js"></script>
        <script src="/chromecast/silvermine-videojs-chromecast.min.js"></script>
        <script type="text/javascript" src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"></script>

        </Head>
        <video disablePictureInPicture id="video" className={Styles.videoPlayer + " video-js vjs-default-skin"} controls preload="auto"></video>

        <div id="container">
        <div style={{backgroundImage: `url('https://image.tmdb.org/t/p/original${metadata.backdrop}')`}} className={Styles.background}></div>
        <div className="backIcon" onClick={() => Router.back()}></div>


        {metadataBox &&
          <div className={Styles.metadataBox}>
            <Form onSubmit={searchMetadata}>
              <Form.Group controlId="formSearch">
                <Form.Label>Sök efter filmen</Form.Label>
                <Form.Control ref={metadataSearch} type="text" placeholder="Sök.." />
              </Form.Group>
              <Button variant="primary" type="submit">
                Sök
              </Button>
            </Form>
            <div style={{clear: 'both'}}></div>

            <ListGroup id="metadataSearchResult">
              {metadataSearchResult}
            </ListGroup>
          </div>
        }

        {imageBox &&
          <div className={Styles.metadataBox}>
  
            <Container>
            <Button style={{display: 'table', margin: '0 auto'}} variant="primary" type="submit" onClick={() => updateImages()}>
                Spara
              </Button>
              <h3>Backdrops</h3>
              <Row>
                {movieBackdropResult}
              </Row>
              <h3>Posters</h3>
              <Row>
                {moviePosterResult}
              </Row>
            </Container>
            
        </div>
        }


        <div className={Styles.top}>
          <div className={Styles.poster} style={{backgroundImage: `url('https://image.tmdb.org/t/p/original${metadata.poster}')`}} />
          <div className={Styles.description}>
            <h1>{metadata.title}</h1>
            <div className={Styles.metadata}>
              <p className={Styles.releaseDate}>{metadata.release_date}</p>
              <p className={Styles.runtime}>{Math.floor(metadata.runtime / 60) + "h " + metadata.runtime%60+"m"}</p>
              <p className={Styles.endsat}>Slutar vid {metadata.finish_at}</p>
              <p className={Styles.addedDate}>Tillagd {metadata.added_date}</p>
            </div>
            <div className={Styles.overview}>
                <p>{metadata.overview}</p>
            </div>
            <div className={Styles.actions}>
              {metadata.currentTimeSeconds > 0 &&
              <div style={{marginRight: "15px"}}>
                <div className={Styles.playButton} onClick={() => setStartWatchin(metadata.currentTimeSeconds)}></div>
                <p style={{marginTop: "5px", fontSize: '14px'}}>Återuppta från {metadata.currentTime}</p>
              </div>
              }
              <div>
                <div className={Styles.playButton} onClick={() => setStartWatchin(0)}></div>
                <p style={{marginTop: "5px", fontSize: '14px'}}>Spela från början</p>
              </div>
              {watched &&
              <>
                  <div style={{marginLeft: "15px"}}>
                  <div id="markAsWatched" style={{backgroundImage: "url('/images/cross.svg')"}} className={Styles.playButton} onClick={() => markAsNotWatched()}></div>
                  <p id="markAsWatchedText" style={{marginTop: "5px", fontSize: '14px'}}>Markera som osedd</p>
                  </div>
              </>
              }
              {!watched &&
              <>
                <div style={{marginLeft: "15px"}}>
                  <div id="markAsWatched" style={{backgroundImage: "url('/images/eye.svg')"}} className={Styles.playButton} onClick={() => markAsWatched()}></div>
                  <p id="markAsWatchedText" style={{marginTop: "5px", fontSize: '14px'}}>Markera som sedd</p>
                </div>
              </>
              }
              <div>
                <div style={{marginLeft: "15px", backgroundImage: "url('/images/search.svg')"}} className={Styles.playButton} onClick={() => setMetadataBox(true)}></div>
                <p style={{marginLeft: "15px", marginTop: "5px", fontSize: '14px'}}>Uppdatera metadata</p>
              </div>

              <div>
                <div style={{marginLeft: "15px", backgroundImage: "url('/images/search.svg')"}} className={Styles.playButton} onClick={() => getImages()}></div>
                <p style={{marginLeft: "15px", marginTop: "5px", fontSize: '14px'}}>Välj bild</p>
              </div>

            </div>
          </div>
        </div>
        <div className={Styles.bottom}>
          <h1>Actors</h1>
          <div className={Styles.actors}>
            <div className={Styles.actor}>

            </div>
          </div>
        </div>
        </div>
        </>
  )
}

// Get the information about the server and send it to the front end before render (this is server-side)
export async function getServerSideProps(context) {
  let serverId = context.params.server;
  let movieID = context.params.id;

  return await fetch('http://88.129.86.234:3000/api/servers/getServer', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          id: serverId
      }),
  })
  .then((r) => r.json())
  .then(async (data) =>{
    // TODO: Flytta till frontend
    return await fetch(`http://${data.server.server_ip}:4000/api/subtitles/list?movie=${movieID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
    })
    .then((r) => r.json())
    .then((subtitles) => {
      return {
        props: {
            server: data.server,
            subtitles: subtitles.subtitles,
            serverToken: cookies(context).serverToken || ''
        }
      }
    })

  });
}