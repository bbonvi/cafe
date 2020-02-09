// Synchronization management message handlers

package websockets

import (
	"meguca/common"

	"encoding/json"
	"errors"
	"meguca/db"
	"meguca/feeds"
	"reflect"
	"smiles"
	"time"
)

type reactRequest struct {
	Smile    string `json:"smile"`
	Post     uint64 `json:"post"`
	ThreadID uint64 `json:"threadId"`
	Count    uint64 `json:"count"`
}

type reactRequests []reactRequest

var reactQueue reactRequests
var started bool

func syncReacts() {
	time.Sleep(time.Second)

	ms := time.Tick(time.Millisecond * 500)

	for {
		select {
		case <-ms:
			threadMap := createMap(reactQueue)
			reactQueue = reactQueue[:0]
			for threadID, t := range threadMap {
				rs := React(t)
				sendToFeed(rs, threadID)
			}
		}
	}
}

type ThreadMap map[uint64]PostMap
type PostMap map[uint64]SmileMap
type SmileMap map[string]uint64

func isNil(v interface{}) bool {
	return v == nil ||
		(reflect.ValueOf(v).Kind() ==
			reflect.Ptr && reflect.ValueOf(v).IsNil())
}

func createMap(reactQueue reactRequests) ThreadMap {
	t := make(ThreadMap)
	p := make(PostMap)

	// SmileMap to PostIDs
	for _, r := range reactQueue {
		PostID := r.Post
		SmileID := r.Smile

		if p[PostID] == nil {
			p[PostID] = make(SmileMap)
		}

		count := p[PostID][SmileID]
		if isNil(count) {
			count = 1
		} else {
			count++
		}

		p[PostID][SmileID] = count
	}

	// Map PostMap to ThreadID
	for postID, m := range p {
		// fmt.Println(o, r)
		threadID, err := db.GetPostOP(postID)
		if err == nil {
			if t[threadID] == nil {
				t[threadID] = make(PostMap)
			}
			t[threadID][postID] = m
		}
	}

	return t
}

func (c *Client) reactToPost(data []byte) error {
	if started != true {
		started = true
		go syncReacts()
	}

	var msg reactRequest
	err := decodeMessage(data, &msg)
	if err != nil {
		return err
	}

	if !smiles.Smiles[msg.Smile] {
		return errors.New("smile not found")
	}

	reactQueue = append(reactQueue, msg)
	// err = React(msg)
	if err != nil {
		return errors.New("couldn't REACT")
	}
	return nil
}

// React gotta react
func React(p PostMap) common.Reacts {
	var r common.Reacts
	for PostID, m := range p {
		for smileName, c := range m {
			count, err := db.GetPostReactCount(PostID, smileName)
			if err != nil {
				count = 0
			}
			count = count + c
			if err != nil {
				db.InsertPostReaction(PostID, smileName)
			} else {
				db.UpdateReactionCount(PostID, smileName, count)
			}

			var re common.React
			re.SmileName = smileName
			re.Count = count
			re.PostID = PostID
			r = append(r, re)
		}
	}

	return r
}

// _React reacts
func _React(r reactRequest) (reactRequest, err error) {
	postID := r.Post
	smileName := r.Smile

	if !smiles.Smiles[smileName] {
		err := errors.New("Smile not found")
		return nil, err
	}

	count, err := db.GetPostReactCount(postID, smileName)
	if err != nil {
		count = 0
	}

	count++
	if count == 1 {
		err = db.InsertPostReaction(postID, smileName)
		if err != nil {
			return nil, err
		}
	} else {
		err = db.UpdateReactionCount(postID, smileName, count)
		if err != nil {
			return nil, err
		}
	}

	threadID, err := db.GetPostOP(postID)
	r.Count = count
	r.ThreadID = threadID

	return

	// msg, _ := json.Marshal("[123]")

	// msg := `{ "reacts":[{ "postId":`
	// msg += fmt.Sprint(postID)
	// msg += `, "smileName": "`
	// msg += smileName
	// msg += `", "count": `
	// msg += fmt.Sprint(count)
	// msg += `}] }`

	// b := make([]byte, 0, 1<<10)
	// b = append(b, msg...)

	// feeds.SendTo(threadID, b)

}

type ReactsMessage struct {
	Reacts common.Reacts `json:"reacts"`
}

func sendToFeed(r common.Reacts, threadID uint64) error {
	var rm ReactsMessage
	rm.Reacts = r
	msgType := `30`
	t := make([]byte, 0, 1<<10)
	t = append(t, msgType...)

	msg, _ := json.Marshal(rm)

	t = append(t, msg...)
	feeds.SendTo(threadID, t)
	return nil
}
